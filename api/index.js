export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { name } = req.query;
  if (!name) {
    return res.status(400).json({ error: 'Subreddit name is required' });
  }

  try {
    const auth = Buffer.from(
      `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
    ).toString('base64');

    const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenRes.ok) {
      throw new Error(`Auth failed: ${tokenRes.status}`);
    }

    const { access_token } = await tokenRes.json();

    const redditRes = await fetch(
      `https://oauth.reddit.com/r/${name}/hot?limit=50`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          'User-Agent': 'SubredditVibeCheck/1.0 (by /u/Ayush-5787)',
        },
      }
    );

    if (!redditRes.ok) {
      if (redditRes.status === 404) {
        return res.status(404).json({ error: `Subreddit "r/${name}" not found.` });
      }
      if (redditRes.status === 429) {
        return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
      }
      throw new Error(`Reddit API error: ${redditRes.status}`);
    }

    const data = await redditRes.json();
    const posts = data.data.children.map((child) => child.data);

    return res.status(200).json({
      subreddit: name,
      posts: posts.map((p) => ({
        title: p.title,
        score: p.score,
        url: `https://reddit.com${p.permalink}`,
        author: p.author,
        created_utc: p.created_utc,
        num_comments: p.num_comments,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}