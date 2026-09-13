/**
 * Admin — এখানে YouTube লিংক, ছবি, মূল্য, Play Store ও রিভিউ বদলান
 * আপলোডের পর শুধু এই ফাইল এডিট করে আবার আপলোড করলেই সাইট আপডেট হবে
 *
 * videos.appSetup     = App Setup Video
 * videos.controller   = Controller Video
 * videos.installation = Installation Video
 * videos.appDetails   = App Details Video
 * reviews[]           = কাস্টমার কমেন্ট স্ক্রিনশট
 * links.playStore     = Google Play Store অ্যাপ লিংক
 *
 * নোট: অ্যাডমিন পাসওয়ার্ড এখানে রাখা হয় না (নিরাপত্তার জন্য)।
 */
window.SITE_CONFIG = {
  links: {
    playStore: "https://play.google.com/store/apps/details?id=com.water.aicontroller&pcampaignid=web_share",
  },
  videos: {
    appSetup: "",
    controller: "",
    installation: "",
    appDetails: "",
  },
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
