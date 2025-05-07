import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { promises } from 'dns';
import { StreamChat } from 'stream-chat';
import OpenAI from 'openai';
import { db } from './config/database.js';
import { chats, users } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { ChatCompletionMessageParam } from 'openai/resources';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize stream chat client
const chatClient = StreamChat.getInstance(
    process.env.STREAM_API_KEY!,
    process.env.STREAM_API_SECRET!
);

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Register user with streamchat
app.post('/register-user',
    async ( req: Request, res : Response): Promise<any> => {
        const { name, email } = req.body;

        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        try {
            const userId = email.replace(/[^a-zA-Z0-9_-]/g, '_');

            // Check if user already exists
            const userResponse = await chatClient.queryUsers({ id: { $eq : userId } });

            if (!userResponse.users.length){
                // add new user
                await chatClient.upsertUser( {
                    id: userId,
                    name: name,
                    email: email,
                    role: 'user'
                } );
            }

            const existingUser = await db
            .select()
            .from( users )
            .where( eq( users.userId,userId ));

            if ( !existingUser.length ) {
                console.log(`adding new user with id: ${userId}`);
                await db.insert( users ).values({ userId, name, email });
            }
        
            return res.status(200).json({ userId, name, email });
        } catch (error) {
            return res.status(500).json({ error: 'Internal Server error' });
        }
        
    }
);

// Send a message to AI.
app.post('/chat', async (req: Request, res: Response): Promise<any> => {
    const { message, userId } = req.body;

    if ( !message || !userId ) {
        return res.status(400).json({ error: "message & user are required." });
    }

    try{
        // Verify user exists.
        const userResponse = await chatClient.queryUsers({ id : { $eq : userId }});
        if (!userResponse.users.length){
            return res.status(404).json({ error: "User not found."});
        }

        // Checking for user in the database
        const existingUser = await db
            .select()
            .from( users )
            .where( eq( users.userId,userId ));

            if ( !existingUser.length ) {
                return res.status(404).json({ error: "user not found in db" });
            }

        // Fetch past messages for context
        const chatHistory = await db
            .select()
            .from (chats )
            .where( eq( chats.userId, userId ))
            .orderBy( chats.createdAt )
            .limit( 10 );

        const convo: ChatCompletionMessageParam[] = chatHistory.flatMap(
            (chat) => [
                { role: 'user', content: chat.message },
                { role: 'assistant', content: chat.reply }
            ]
        );

        convo.push({ role: 'user', content: message });
        
        // Send a message to OpenAI.
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: convo as ChatCompletionMessageParam[],
        });

        const aiMessage: string =  response.choices[0].message?.content ?? 'No response from AI';

        // Saving chat to db
        await db.insert( chats ).values({ userId, message, reply: aiMessage});

        // Creating/ accessing channel
        const channel = chatClient.channel('messaging', `chat-${userId}`, {
            name: 'DM AI',
            created_by_id: 'ai_bot'
        });

        await channel.create();
        await channel.sendMessage({ text: aiMessage, user_id: 'ai_bot' });

        res.status(200).json({ reply: aiMessage });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "internal server error." });
    }

});

// Get all chats for a user
app.post( '/get-messages', async ( req: Request, res: Response ): Promise<any> => {
    const { userId } = req.body;

    if ( !userId ) {
        return res.status(400).json({ error: 'userId is required' });
    }

    try{
        const chatHistory = await db
            .select()
            .from (chats )
            .where( eq( chats.userId, userId ));

            res.status(200).json({ messages: chatHistory });
    } catch ( error ) {
        console.error( error );
        res.status(500).json({error: "internal server error."});
    }

} );

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));