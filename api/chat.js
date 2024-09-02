import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { userMessage } = req.body;

    try {
      // Create a new thread
      const thread = await openai.beta.threads.create();
      const threadId = thread.id;

      // Send the user's message
      await openai.beta.threads.messages.create(
        threadId,
        { role: 'user', content: userMessage }
      );

      // Create and run the thread
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

      res.status(200).json({ response: responseContent });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
