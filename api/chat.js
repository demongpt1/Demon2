import dotenv from 'dotenv';
import { json } from 'micro';
import pkg from 'openai'; // Import the entire module
const { OpenAI } = pkg; // Extract OpenAI from the module

dotenv.config();

// Create an OpenAI client instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { userMessage } = await json(req);

      // Create a new thread
      const thread = await openai.threads.create();
      const threadId = thread.id;

      // Send the user's message
      await openai.threads.messages.create(threadId, { role: 'user', content: userMessage });

      // Create and run the assistant
      const stream = await openai.threads.createAndRun({
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
      // Ensure the response is valid JSON
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
