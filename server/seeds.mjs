export async function seedDatabase(db) {
  const defaults = {
    site: {
      phone: "",
      address: "",
      hours: "10:00 — 20:00",
      wechat: "",
      samplePricing: true,
      defaultTheme: "ivory",
    },
    booking: {
      enabled: true,
      times: ["10:00", "13:00", "15:00", "17:00"],
      capacity: 2,
      minAdvanceDays: 1,
      maxAdvanceDays: 90,
      closedWeekdays: [],
      blockedDates: [],
    },
    epay: {
      enabled: false,
      gateway: "",
      pid: "",
      secret: "",
      methods: ["alipay", "wxpay"],
    },
  };
  for (const [key, value] of Object.entries(defaults))
    await db
      .prepare("INSERT IGNORE INTO settings(setting_key,value) VALUES (?,?)")
      .run(key, JSON.stringify(value));
  {
    const seeds = [
      [
        "bridal",
        "婚纱摄影",
        "THE WEDDING",
        "婚纱拍摄",
        "把心动，写进光影里。以自然的情绪和细腻的镜头语言，珍藏属于你们的婚纱记忆。",
        299900,
        59900,
        "半日专属拍摄",
        [
          "一对一风格沟通",
          "精修影像 20 张",
          "两套婚纱与造型",
          "全程专属摄影师",
        ],
        "/images/wedding.jpg",
        1,
      ],
      [
        "birthday",
        "生日宴会布置",
        "A DAY TO CELEBRATE",
        "生日宴会",
        "从花艺、色彩到每一处桌面细节，为值得庆祝的一天，营造只属于你的仪式感。",
        129900,
        29900,
        "按场地定制",
        ["主题方案设计", "花艺与场景布置", "现场搭建服务", "专属色彩搭配"],
        "/images/celebration.jpg",
        0,
      ],
      [
        "fashion",
        "服装与写真",
        "YOUR OWN MUSE",
        "服装拍摄",
        "不必成为别人。无论日常风格、个人写真或品牌服装，用影像呈现你的独特表达。",
        89900,
        19900,
        "约 2 小时",
        ["风格策划与沟通", "精修影像 12 张", "两套服装拍摄", "支持男女生写真"],
        "/images/portrait.jpg",
        0,
      ],
      [
        "rental",
        "婚纱礼服租赁",
        "THE PERFECT DRESS",
        "婚纱租赁",
        "让一袭礼服，回应你对美的想象。从试纱到搭配，细致陪伴每一个重要选择。",
        59900,
        19900,
        "租期到店沟通",
        ["预约到店试纱", "礼服搭配建议", "尺码调整咨询", "专业清洁养护"],
        "/images/dress.jpg",
        0,
      ],
      [
        "makeup",
        "化妆造型拍摄",
        "BEAUTY IN DETAIL",
        "化妆拍摄",
        "在细节里，看见本来的光彩。定制造型与镜头美学，让美自然发生。",
        69900,
        19900,
        "约 2 小时",
        ["专属妆容沟通", "专业化妆与发型", "精修影像 9 张", "提供造型建议"],
        "/images/beauty.jpg",
        0,
      ],
      [
        "cosplay",
        "Cosplay 主题摄影",
        "BE WHO YOU IMAGINE",
        "Cosplay",
        "跨越日常，走进热爱的角色。女生、男生和每一种表达，都值得被认真记录。",
        99900,
        29900,
        "约 3 小时",
        [
          "角色与分镜沟通",
          "精修影像 15 张",
          "主题光影布景",
          "支持男生女生拍摄",
        ],
        "/images/cosplay.jpg",
        0,
      ],
    ];
    const insert = db.prepare(
      "INSERT IGNORE INTO services(id,title,english,category,description,price,deposit,duration,features,image,featured,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    );
    await Promise.all(
      seeds.map(
        async (s, i) =>
          await insert.run(
            s[0],
            s[1],
            s[2],
            s[3],
            s[4],
            s[5],
            s[6],
            s[7],
            JSON.stringify(s[8]),
            s[9],
            s[10],
            i,
          ),
      ),
    );
  }
}
