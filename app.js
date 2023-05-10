require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require("openai");
const cheerio = require('cheerio');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(bodyParser.json());

const {google} = require('googleapis');
const youtube = google.youtube({version: 'v3', auth: `${process.env.YOUTUBEAPI_AUTH}`});
let channelId=""


const corsOptions = {
    origin: `${process.env.ORIGIN_URL}`,// クライアント側のオリジンを許可する
    methods: ['GET', 'POST'], // 許可されるHTTPメソッド
    allowedHeaders: ['Content-Type', 'Authorization'], // 許可されるヘッダー
  };

  app.use(cors(corsOptions));
const callGpt3 = async()=>{
    console.log("start")
    const configuration = new Configuration({
        apiKey: `${process.env.GPT_AUTH}`,
      });
      const openai = new OpenAIApi(configuration);
      
      const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{role: "user", content: `
        競合チャンネルの分析を行い、次に出す動画のアイデアや人気動画の傾向、タイトルなど、動画制作に役立つ提案を日本語でしてください。

        チャンネル名: ${channel_name}
        登録者数: ${subscriber_count}
        全体の視聴回数: ${total_view_count}
        チャンネル開設日: ${channel_creation_date}
        人気動画のタイトルリスト: ${popular_video_titles}
        `}],
      });
      console.log("gptレスポンス");
      console.log(completion.data.choices[0]);
      gptResponce=completion.data.choices[0].message.content
      return gptResponce;
}

//チャンネル情報の取得
const getChannelInfo = async ()=>{
    const res = await youtube.channels.list({
        part: 'snippet,contentDetails,statistics',
        id: channelId
    })
    return res.data
}

//人気動画の取得
const getPopularVideos = async()=>{
    const res = await youtube.search.list({
        part: 'snippet',
        channelId: channelId,
        type: 'video',
        order: 'viewCount',
        maxResults: 50,
    })
    const videoIds =res.data.items.map(video => video.id.videoId)
    //各ビデオオブジェクトからid.videoIdを抽出し、videoIds配列に格納。
    //これにより、配列videoIdsには、検索クエリに一致するビデオのIDだけが含まれる。

    const videoResponse =await youtube.videos.list({
        part: 'snippet,statistics',
        id: videoIds.join(','),
        })
        return videoResponse.data.items;
}

//chatGPTの設定
// YouTube APIで取得した情報を変数に格納
let channel_name = "取得したチャンネル名";
let subscriber_count = "取得した登録者数";
let total_view_count = "取得した全体の視聴回数";
let channel_creation_date = "取得したチャンネル開設日";
let popular_video_titles = "取得した人気動画のタイトルリスト";

let gptResponce =''

app.get('/api/youtube', async(req, res) => {
    try{
       const channelInfo = await getChannelInfo()
       const popularVideos = await getPopularVideos()
       res.send({
        channelInfo:channelInfo,
        popularVideos:popularVideos
       });
    }
    catch(error){
        console.log(error)
        res.status(500).send("エラー")
    }
});

app.post('/api/gpt', async(req, res) => {
    try{
    channel_name = req.body.channelName
    subscriber_count = req.body.subscriberCount
    total_view_count = req.body.totalViewCount
    channel_creation_date = req.body.channelCreationDate
    popular_video_titles = req.body.popularVideoTitles

    const gptResult = await callGpt3()
    res.send(gptResult);
    }
    catch(error){
        console.log(error)
        res.status(500).send("エラー")
    }
});

app.get('/api/getChannelId', async (req, res) => {
    const channelUrl = req.query.channelUrl;
  
    try {
      const response = await axios.get(channelUrl);
      const $ = cheerio.load(response.data);
      channelId = $('meta[itemprop="channelId"]').attr('content');
  
      res.json({ channelId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch channel ID' });
    }
  });
  

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}...`));
