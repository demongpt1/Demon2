import OpenAI from 'openai';
import dotenv from 'dotenv';
import { json } from 'micro';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In-memory storage for user sessions
const userSessions = {};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { userId, userMessage, action } = await json(req);

      // Check if the user has an active thread
      if (!userSessions[userId]) {
        // Create a new thread for the user if it doesn't exist
        const thread = await openai.beta.threads.create();
        userSessions[userId] = thread.id;
        console.log(`Created thread for user ${userId}: ${thread.id}`);
      }

      const threadId = userSessions[userId];

      if (action === 'exit') {
        // Delete the thread if the user wants to exit
        await openai.beta.threads.delete(threadId);
        delete userSessions[userId];
        console.log(`Deleted thread for user ${userId}`);
        res.status(200).json({ response: 'Session ended.' });
        return;
      }

      // Send the user's message
      await openai.beta.threads.messages.create(threadId, { role: 'user', content: userMessage });

      // Create and run the assistant with the existing thread
      const stream = await openai.beta.threads.createAndRun({
        assistant_id: process.env.ASSISTANT_ID,
        thread: { messages: [{ role: 'user', content: userMessage }] },
        stream: true,
      });

      let responseContent = '';
      for await (const event of stream) {
        if (event.object === 'thread.message.delta') {
          responseContent += event.delta.content.map(c => c.text.value).join('');
        }
      }

      // Respond with the assistant's message
      res.status(200).json({ response: responseContent });
    } catch (error) {
      console.error('Error:', error);
      if (error.response) {
        console.error('Response error:', error.response.data);
      }
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
