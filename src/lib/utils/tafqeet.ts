/**
 * HMS Egypt - Dynamic Tafqeet Utility
 * Converts integer numbers to grammatically precise written Arabic words
 * for Egyptian Pounds (EGP / جنيه مصري) in compliance with Egyptian Tax Authority (ETA) guidelines.
 */

export function tafqeet(rawNum: number): string {
  const num = Math.round(rawNum); // Fallback gracefully to nearest integer

  if (num < 0) return "قيمة سالبة غير صالحة";
  if (num >= 1_000_000_000) return "القيمة تتجاوز الحد الأقصى للتفقيط";


  if (num === 0) return "صفر جنيه مصري فقط لا غير";
  if (num === 1) return "جنيه مصري واحد فقط لا غير";
  if (num === 2) return "جنيهان مصريان فقط لا غير";

  const ones = [
    "",
    "واحد",
    "اثنان",
    "ثلاثة",
    "أربعة",
    "خمسة",
    "ستة",
    "سبعة",
    "ثمانية",
    "تسعة",
    "عشرة",
    "أحد عشر",
    "اثنا عشر",
    "ثلاثة عشر",
    "أربعة عشر",
    "خمسة عشر",
    "ستة عشر",
    "سبعة عشر",
    "ثمانية عشر",
    "تسعة عشر",
  ];

  const tens = [
    "",
    "عشرة",
    "عشرون",
    "ثلاثون",
    "أربعون",
    "خمسون",
    "ستون",
    "سبعون",
    "ثمانون",
    "تسعون",
  ];

  const hundreds = [
    "",
    "مائة",
    "مائتان",
    "ثلاثمائة",
    "أربعمائة",
    "خمسمائة",
    "ستمائة",
    "سبعمائة",
    "ثمانمائة",
    "تسعمائة",
  ];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const remainder = n % 10;
      return remainder === 0 ? tens[ten] : `${ones[remainder]} و${tens[ten]}`;
    }
    if (n < 1000) {
      const hundred = Math.floor(n / 100);
      const remainder = n % 100;
      if (remainder === 0) return hundreds[hundred];
      const hundredText = hundreds[hundred];
      return `${hundredText} و${convert(remainder)}`;
    }
    if (n < 2000) {
      const remainder = n % 1000;
      return remainder === 0 ? "ألف" : `ألف و${convert(remainder)}`;
    }
    if (n < 3000) {
      const remainder = n % 1000;
      return remainder === 0 ? "ألفان" : `ألفان و${convert(remainder)}`;
    }
    if (n < 11000) {
      const thousand = Math.floor(n / 1000);
      const remainder = n % 1000;
      return remainder === 0 ? `${ones[thousand]} آلاف` : `${ones[thousand]} آلاف و${convert(remainder)}`;
    }
    if (n < 1000000) {
      const thousand = Math.floor(n / 1000);
      const remainder = n % 1000;
      return remainder === 0 ? `${convert(thousand)} ألف` : `${convert(thousand)} ألف و${convert(remainder)}`;
    }
    if (n < 2000000) {
      const remainder = n % 1000000;
      return remainder === 0 ? "مليون" : `مليون و${convert(remainder)}`;
    }
    if (n < 3000000) {
      const remainder = n % 1000000;
      return remainder === 0 ? "مليونان" : `مليونان و${convert(remainder)}`;
    }
    if (n < 11000000) {
      const million = Math.floor(n / 1000000);
      const remainder = n % 1000000;
      return remainder === 0 ? `${ones[million]} ملايين` : `${ones[million]} ملايين و${convert(remainder)}`;
    }
    // Up to 999,999,999
    const million = Math.floor(n / 1000000);
    const remainder = n % 1000000;
    return remainder === 0 ? `${convert(million)} مليون` : `${convert(million)} مليون و${convert(remainder)}`;
  }

  const text = convert(num);

  // Apply grammatical dual and plural rules for Egyptian Pounds (جنيه مصري)
  const lastTwoDigits = num % 100;
  
  // Handle strict grammatical endings for 1 and 2 if the overall number is > 2
  if (num > 2) {
    if (lastTwoDigits === 1) {
      // e.g. 101 -> "مائة وجنيه مصري واحد فقط لا غير"
      // Strip trailing " وواحد"
      const cleanText = text.replace(/ وواحد$/, "");
      return `${cleanText} وجنيه مصري واحد فقط لا غير`;
    }
    if (lastTwoDigits === 2) {
      // e.g. 102 -> "مائة وجنيهان مصريان فقط لا غير"
      // Strip trailing " واثنان"
      const cleanText = text.replace(/ واثنان$/, "");
      return `${cleanText} وجنيهان مصريان فقط لا غير`;
    }
  }

  let currencySuffix = "جنيه مصري";
  
  if (lastTwoDigits >= 3 && lastTwoDigits <= 10) {
    currencySuffix = "جنيهات مصرية";
  } else if (lastTwoDigits >= 11 && lastTwoDigits <= 99) {
    currencySuffix = "جنيهاً مصرياً";
  }

  return `${text} ${currencySuffix} فقط لا غير`;
}
