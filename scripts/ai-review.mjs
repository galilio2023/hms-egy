import fs from 'fs';

async function run() {
  const diff = fs.readFileSync(0, 'utf-8');
  if (!diff.trim()) {
    console.log('No changes to review.');
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';

  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
    process.exit(1);
  }

  const prompt = `
    You are an expert senior software engineer and security researcher.
    Review the following git diff and provide a concise, high-signal code review.
    Focus on:
    - Potential bugs and edge cases.
    - Security vulnerabilities.
    - Performance bottlenecks.
    - Maintainability and idiomatic code patterns.
    - Specific feedback for the HMS Egypt project (RTL support, Egyptian context if applicable).

    Format your response in Markdown. Do not be overly pedantic; focus on meaningful improvements.

    Diff:
    ${diff}
  `;

  const maxRetries = 3;
  let attempt = 0;
  let success = false;

  while (attempt < maxRetries && !success) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API responded with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const review = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No review generated.';

      fs.writeFileSync('review.md', review);
      success = true;
    } catch (error) {
      attempt++;
      console.warn(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt >= maxRetries) {
        console.error('Error calling Gemini API after max retries:', error);
        process.exit(1);
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

run();
