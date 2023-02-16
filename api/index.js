// @version 0.0.6 新增 429 限频场景下的兼容
// const aircode = require("aircode");
const lark = require("@larksuiteoapi/node-sdk");
var axios = require("axios");
// const EventDB = aircode.db.table("event");

// 如果你不想配置环境变量，或环境变量不生效，则可以把结果填写在每一行最后的 "" 内部
const FEISHU_APP_ID = "cli_a3a83d108eb9900b"|| ""; // 飞书的应用 ID
const FEISHU_APP_SECRET = "9Ojzkhvp3jdzyjQSMdRXiXpyQs0aUhhd" || ""; // 飞书的应用的 Secret
const FEISHU_BOTNAME = "部署机器人" || ""; // 飞书机器人的名字
const OPENAI_KEY = "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" || ""; // OpenAI 的 Key
const OPENAI_MODEL = "text-davinci-003"; // 使用的模型
const OPENAI_MAX_TOKEN = 1024; // 最大 token 的值

const client = new lark.Client({
  appId: FEISHU_APP_ID,
  appSecret: FEISHU_APP_SECRET,
  disableTokenCache: false,
});

// 日志辅助函数，请贡献者使用此函数打印关键日志
function logger(param) {
  console.warn(`[CF]`, param);
}

// 回复消息
async function reply(messageId, content) {
  try{
    return await client.im.message.reply({
    path: {
      message_id: messageId,
    },
    data: {
      content: JSON.stringify({
        text: content,
      }),
      msg_type: "text",
    },
  });
  } catch(e){
    logger("send message to feishu error",e,messageId,content);
  }
}

// 根据中英文设置不同的 prompt
function getPrompt(content) {
  if (content.length === 0) {
    return "";
  }
  if (
    (content[0] >= "a" && content[0] <= "z") ||
    (content[0] >= "A" && content[0] <= "Z")
  ) {
    return (
      "You are ChatGPT, a LLM model trained by OpenAI. \nplease answer my following question\nQ: " +
      content +
      "\nA: "
    );
  }

  return (
    "你是 ChatGPT, 一个由 OpenAI 训练的大型语言模型, 你旨在回答并解决人们的任何问题，并且可以使用多种语言与人交流。\n请回答我下面的问题\nQ: " +
    content +
    "\nA: "
  );
}

// 通过 OpenAI API 获取回复
async function getOpenAIReply(content) {
  var prompt = getPrompt(content.trim());

  var data = JSON.stringify({
    model: OPENAI_MODEL,
    prompt: prompt,
    max_tokens: OPENAI_MAX_TOKEN,
    temperature: 0.9,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    top_p: 1,
    stop: ["#"],
  });
  var config = {
    method: "post",
    maxBodyLength: Infinity,
    url: "https://api.openai.com/v1/completions",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    data: data,
  };

  try{
      const response = await axios(config);

      if (response.status === 429) {
        return '请求过于频繁，请稍后再试';
      }
      // 去除多余的换行
      return response.data.choices[0].text.replace("\n\n", "");

  }catch(e){
     logger(e)
     return "请求失败";
  }

}

// 自检函数
async function doctor(response) {
  if (FEISHU_APP_ID === "") {
    return response.status(200).json({
      code: 1,
      message: {
        zh_CN: "你没有配置飞书应用的 AppID，请检查 & 部署后重试",
        en_US:
          "Here is no FeiSHu APP id, please check & re-Deploy & call again",
      },
    });
  }
  if (!FEISHU_APP_ID.startsWith("cli_")) {
    return response.status(200).json({
      code: 1,
      message: {
        zh_CN:
          "你配置的飞书应用的 AppID 是错误的，请检查后重试。飞书应用的 APPID 以 cli_ 开头。",
        en_US:
          "Your FeiShu App ID is Wrong, Please Check and call again. FeiShu APPID must Start with cli",
      },
    });
  }
  if (FEISHU_APP_SECRET === "") {
    return response.status(200).json({
      code: 1,
      message: {
        zh_CN: "你没有配置飞书应用的 Secret，请检查 & 部署后重试",
        en_US:
          "Here is no FeiSHu APP Secret, please check & re-Deploy & call again",
      },
    });
  }

  if (FEISHU_BOTNAME === "") {
    return response.status(200).json({
      code: 1,
      message: {
        zh_CN: "你没有配置飞书应用的名称，请检查 & 部署后重试",
        en_US:
          "Here is no FeiSHu APP Name, please check & re-Deploy & call again",
      },
    });
  }

  if (OPENAI_KEY === "") {
    return response.status(200).json({
      code: 1,
      message: {
        zh_CN: "你没有配置 OpenAI 的 Key，请检查 & 部署后重试",
        en_US: "Here is no OpenAI Key, please check & re-Deploy & call again",
      },
    });
  }

  if (!OPENAI_KEY.startsWith("sk-")) {
    return {
      code: 1,
      message: {
        zh_CN:
          "你配置的 OpenAI Key 是错误的，请检查后重试。飞书应用的 APPID 以 cli_ 开头。",
        en_US:
          "Your OpenAI Key is Wrong, Please Check and call again. FeiShu APPID must Start with cli",
      },
    };
  }
  return response.status(200).json({
    code: 0,
    message: {
      zh_CN:
      "✅ 配置成功，接下来你可以在飞书应用当中使用机器人来完成你的工作。",
      en_US:
      "✅ Configuration is correct, you can use this bot in your FeiShu App",

    },
    meta: {
      FEISHU_APP_ID,
      OPENAI_MODEL,
      OPENAI_MAX_TOKEN,
      FEISHU_BOTNAME,
    },
  });
}

module.exports = async function (request, response) {
  // 如果存在 encrypt 则说明配置了 encrypt key
  logger("这里");
  // 处理飞书开放平台的服务端校验
  if (request.body.type === "url_verification") {
    logger("deal url_verification");
    return response.status(200).json({
      challenge: params.body.challenge,
    });
  }
  // 自检查逻辑
  if (!request.body.hasOwnProperty("header")) {
    logger("enter doctor");
    const result =  await doctor(response);
    return result
  }
  // 处理飞书开放平台的事件回调
  if ((request.body.header.event_type === "im.message.receive_v1")) {
    let eventId = request.body.header.event_id;
    let messageId = request.body.event.message.message_id;

    // 对于同一个事件，只处理一次
    // const count = await EventDB.where({ event_id: eventId }).count();
    // if (count != 0) {
    //   logger("deal repeat event");
    //   return { code: 1 };
    // }
    // await EventDB.save({ event_id: eventId });

    // 私聊直接回复
    if (request.body.event.message.chat_type === "p2p") {
      // 不是文本消息，不处理
      if (request.body.event.message.message_type != "text") {
        await reply(messageId, "暂不支持其他类型的提问");
        logger("skip and reply not support");
        return response.status(200).json( { code: 0 });
      }
      // 是文本消息，直接回复
      const userInput = JSON.parse(request.body.event.message.content);
      const question = userInput.text.replace("@_user_1", "");
      const openaiResponse = await getOpenAIReply(question);
      await reply(messageId, openaiResponse);
      return response.status(200).json({ code: 0 });
    }

    // 群聊，需要 @ 机器人
    if (request.body.event.message.chat_type === "group") {
      // 这是日常群沟通，不用管
      if (
        !request.body.event.message.mentions ||
        request.body.event.message.mentions.length === 0
      ) {
        logger("not process message without mention");
        return response.status(200).json({ code: 0 });
      }
      // 没有 mention 机器人，则退出。
      if (request.body.event.message.mentions[0].name != FEISHU_BOTNAME) {
        logger("bot name not equal first mention name ");
        return response.status(200).json({ code: 0 });
      }
      const userInput = JSON.parse(request.body.event.message.content);
      const question = userInput.text.replace("@_user_1", "");
      const openaiResponse = await getOpenAIReply(question);
      await reply(messageId, openaiResponse);
      return response.status(200).json({ code: 0 });
    }
  }

  logger("return without other log");
  return response.status(200).json({
    code: 2,
  });
};
