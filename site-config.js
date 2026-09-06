/**
 * Admin — এখানে YouTube লিংক, ছবি ও মূল্য বদলান
 * আপলোডের পর শুধু এই ফাইল এডিট করে আবার আপলোড করলেই সাইট আপডেট হবে
 *
 * videos.installation = Total Installation & Setup (YouTube লিংক বা Video ID)
 * videos.howItWorks   = কীভাবে কাজ করে
 * prices.controller   = Controller মূল্য
 * prices.sensorBasic  = Normal Sensor মূল্য
 * prices.sensor       = Premium Sensor মূল্য
 * prices.cablePerFoot = Cable প্রতি ফুট
 */
window.SITE_CONFIG = {
  videos: {
    installation: "",
    howItWorks: "",
    controller: "",
    sensor: "",
  },
  images: {
    controller: "assets/product-controller.png",
    sensor: "assets/sensor.png",
    sensorBasic: "assets/sensor-basic.png",
    controllerFallback: "assets/product-controller.svg",
    sensorFallback: "assets/sensor.svg",
    sensorBasicFallback: "assets/sensor.svg",
    poster: "assets/promo-poster.png",
  },
  prices: {
    controller: 4500,
    sensorBasic: 199,
    sensor: 1550,
    cablePerFoot: 8,
  },
};
