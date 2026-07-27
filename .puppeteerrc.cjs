const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // تحديد مسار دائم ومضمون لـ Chrome داخل مجلد المشروع
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
