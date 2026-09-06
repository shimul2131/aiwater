# Assets — Admin গাইড

## ছবি (PNG/JPG)

| ফাইল | কোথায় দেখাবে |
|------|----------------|
| `product-controller.png` | হোম পেজ + প্যাকেজ (Controller) |
| `sensor.png` | প্যাকেজ (Sensor) |
| `app_icon.png` | লোগো / favicon |

ছবি `assets` ফোল্ডারে রাখুন। না থাকলে `.svg` placeholder দেখাবে।

---

## YouTube ভিডিও

`c:\Website\site-config.js` ফাইল খুলে লিংক দিন:

```javascript
videos: {
  howItWorks: "https://www.youtube.com/watch?v=আপনার_ভিডিও_ID",
  controller: "https://youtu.be/আপনার_ভিডিও_ID",
  sensor: "ভিডিও_ID",
},
```

| কী | কোথায় |
|----|--------|
| `howItWorks` | কীভাবে কাজ করে সেকশন |
| `controller` | হোম + প্যাকেজ Controller |
| `sensor` | প্যাকেজ Sensor |

খালি `""` রাখলে সেই ভিডিও দেখাবে না।
