const axios = require('axios');

const APIURL = 'http://localhost:4000/api/login';

const postData = async (url, data, cookieHeader) => {
  try {
    const res = await axios.post(url, data, {
      headers: { Cookie: cookieHeader },
      withCredentials: true
    });
    return res.data;
  } catch (err) {
    console.error('API error:', err.message);
    return null;
  }
};

module.exports = {postData, APIURL};