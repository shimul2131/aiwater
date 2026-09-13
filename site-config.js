/**
 * Admin — এখানে YouTube লিংক, ছবি, মূল্য, অ্যাডমিন পাসওয়ার্ড, Play Store ও রিভিউ বদলান
 * আপলোডের পর শুধু এই ফাইল এডিট করে আবার আপলোড করলেই সাইট আপডেট হবে
 *
 * videos.appSetup     = App Setup Video
 * videos.controller   = Controller Video
 * videos.installation = Installation Video
 * videos.appDetails   = App Details Video
 * reviews[]           = কাস্টমার কমেন্ট স্ক্রিনশট (assets/reviews/ ফোল্ডারে ছবি রেখে পাথ দিন)
 * links.playStore     = Google Play Store অ্যাপ লিংক
 */
window.SITE_CONFIG = {
  admin: {
    password: "fres1234",
  },
  links: {
    playStore: "https://play.google.com/store/apps/details?id=com.water.aicontroller&pcampaignid=web_share",
  },
  videos: {
    appSetup: "",
    controller: "",
    installation: "",
    appDetails: "",
  },
  // কাস্টমার কমেন্ট স্ক্রিনশট — assets/reviews/ এ ছবি আপলোড করে এখানে পাথ যোগ করুন
  // অথবা Admin Panel থেকে সরাসরি আপলোড করুন
  reviews: [
    "assets/reviews/comment-1.png",
    "assets/reviews/comment-2.png",
  ],
  images: {
    controller: "assets/product-controller.png",
    sensor: "assets/sensor.png",
    controllerFallback: "assets/product-controller.svg",
    sensorFallback: "assets/sensor.svg",
    poster: "assets/promo-poster.png",
  },
  prices: {
    controller: 4500,
    sensor: 1550,
    cablePerFoot: 8,
  },
};
