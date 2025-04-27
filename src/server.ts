import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { promises } from 'dns';
import { StreamChat } from 'stream-chat';
import OpenAI from 'openai';

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
                });
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

        // Send a message to OpenAI.
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user' , content: message}]
        });

        console.log(response.choices[0].message);
        res.send('Success');

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "internal server error." });
    }

});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));