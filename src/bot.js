const process = require('process');
process.setMaxListeners(5000);
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const ProxyChecker = require('./proxyChecker');
const initLogger = require('./logger'); // Mengimpor logger dari logger.js

class Bot {
  constructor(config) {
    this.config = config;
    this.logger = initLogger();
    this.proxyCheck = new ProxyChecker(config, this.logger);
  }

  async connect(token, proxy = null) {
    try {
      const userAgent = 'Mozilla/5.0 ... Safari/537.3';
      const accountInfo = await this.getSession(token, userAgent, proxy);

      const { hours, minutes, seconds } = this.getCurrentTime();

      console.log(
        `${hours}:${minutes}:${seconds} [work]:  ${'Connected to session for UID:'.green} ${accountInfo.uid}`
      );
      this.logger.info(' Session info', {
        uid: accountInfo.uid,
        reward: accountInfo.balance.total_collected,
        username: accountInfo.name,
        useProxy: !!proxy,
      });

      console.log('');

      const interval = setInterval(async () => {
        const { hours, minutes, seconds } = this.getCurrentTime();
        try {
          await this.sendPing(accountInfo, token, userAgent, proxy);
        } catch (error) {
          console.log(`${hours}:${minutes}:${seconds} [error]: ${'Ping error'.red}: ${error.message}`);
          this.logger.error('Ping error', { error: error.message });
        }
      }, this.config.retryInterval);

      process.on('SIGINT', () => clearInterval(interval));
    } catch (error) {
      const { hours, minutes, seconds } = this.getCurrentTime();
      console.log(`${hours}:${minutes}:${seconds} [error]: ${'Connection error'.red}: ${error.message}`);
      this.logger.error('Connection error', { error: error.message, proxy });
    }
  }

  async getSession(token, userAgent, proxy) {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
          Accept: 'application/json',
        },
      };

      if (proxy) {
        config.proxy = this.buildProxyConfig(proxy);
      }

      const response = await axios.post(this.config.sessionURL, {}, config);
      return response.data.data;
    } catch (error) {
      throw new Error('Session request failed');
    }
  }

  async sendPing(accountInfo, token, userAgent, proxy) {
    const uid = accountInfo.uid || crypto.randomBytes(8).toString('hex');
    const browserId =
      accountInfo.browser_id || crypto.randomBytes(8).toString('hex');
    const reward = accountInfo.balance.total_collected || crypto.randomBytes(8).toString('hex');
	const name = accountInfo.name || crypto.randomBytes(8).toString('hex');

    const pingData = {
      id: uid,
      browser_id: browserId,
      timestamp: Math.floor(Date.now() / 1000),
      version: '2.2.7',
	  usename: name,
    };

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
          Accept: 'application/json',
        },
      };

      if (proxy) {
        config.proxy = this.buildProxyConfig(proxy);
      }

      await axios.post(this.config.pingURL, pingData, config);

      const { hours, minutes, seconds } = this.getCurrentTime();
      console.log(`${hours}:${minutes}:${seconds} [Done]:  ${'Ping sent for username:'.cyan} ${name} ${'- reward poin:'.cyan} ${reward}`);
      this.logger.info(' Ping Success', {
        uid,
        browserId,
        ip: proxy ? proxy.host : 'direct',
      });
      
// Simpan proxy host dan port ke live.txt
      this.saveProxyInfo(proxy);
    } catch (error) {
      throw new Error('Ping request failed');
    }
  }

  getCurrentTime() {
    const now = new Date();
    return {
      hours: now.getHours(),
      minutes: now.getMinutes().toString().padStart(2, '0'),
      seconds: now.getSeconds().toString().padStart(2, '0')
    };
  }



  saveProxyInfo(proxy) {
    if (proxy && proxy.host && proxy.port) {
      const proxyInfo = `${proxy.host}:${proxy.port}`;
      const filePath = 'live.txt';

      // Baca isi file
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          this.logger.error('Error reading live.txt', { error: err.message });
          return;
        }

        // Split isi file menjadi baris
        const lines = data.split('\n');
        // Cek apakah proxyInfo sudah ada di file
        if (!lines.includes(proxyInfo)) {
          // Jika belum ada, tambahkan ke file
          fs.appendFile(filePath, `${proxyInfo}\n`, (err) => {
            if (err) {
              this.logger.error('Error saving proxy info to live.txt', { error: err.message });
            } else {
              this.logger.info(`${` Saved proxy info to live.txt`.green}`, { proxyInfo });
            }
          });
        } else {
          this.logger.info(`${` Proxy info already exists in live.txt`.yellow}`, { proxyInfo });
        }
      });
    }
  }

  buildProxyConfig(proxy) {
    return proxy && proxy.host
      ? {
          host: proxy.host,
          port: parseInt(proxy.port),
          auth:
            proxy.username && proxy.password
              ? { username: proxy.username, password: proxy.password }
              : undefined,
        }
      : undefined;
  }
}


module.exports = Bot;