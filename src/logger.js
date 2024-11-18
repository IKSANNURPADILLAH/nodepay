const { createLogger, format, transports } = require('winston');
const { combine, printf } = format;

// Custom timestamp format function
const customTimestamp = format((info) => {
  const date = new Date();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  info.timestamp = `${hours}:${minutes}:${seconds}`;
  return info;
});

// Fungsi untuk menginisialisasi logger
function initLogger() {
  return createLogger({
    level: 'info',
    format: combine(
      customTimestamp(),
      printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} [${level}]: ${message} ${
          Object.keys(meta).length ? JSON.stringify(meta) : ''
        }`;
      })
    ),
    transports: [
      new transports.Console(),
      new transports.File({ filename: 'bot.log' }),
    ],
  });
}

module.exports = initLogger;
