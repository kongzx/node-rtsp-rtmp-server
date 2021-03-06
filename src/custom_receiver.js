// Generated by CoffeeScript 1.7.1
(function() {
  var CustomReceiver, TAG, avstreams, config, fs, hybrid_udp, logger, net;

  net = require('net');

  fs = require('fs');

  config = require('../config');

  avstreams = require('./avstreams');

  hybrid_udp = require('./hybrid_udp');

  logger = require('./logger');

  TAG = 'custom_receiver';

  CustomReceiver = (function() {
    function CustomReceiver(type, callback) {
      var _ref;
      this.type = type;
      if (callback == null) {
        throw new Error("Mandatory callback argument is not passed");
      }
      if (callback.videoControl == null) {
        throw new Error("Mandatory callback.videoControl is not passed");
      }
      if (callback.audioControl == null) {
        throw new Error("Mandatory callback.audioControl is not passed");
      }
      if (callback.videoData == null) {
        throw new Error("Mandatory callback.videoData is not passed");
      }
      if (callback.audioData == null) {
        throw new Error("Mandatory callback.audioData is not passed");
      }
      if ((_ref = this.type) === 'unix' || _ref === 'tcp') {
        this.videoControlReceiver = this.createReceiver('VideoControl', callback.videoControl);
        this.audioControlReceiver = this.createReceiver('AudioControl', callback.audioControl);
        this.videoDataReceiver = this.createReceiver('VideoData', callback.videoData);
        this.audioDataReceiver = this.createReceiver('AudioData', callback.audioData);
      } else if (this.type === 'udp') {
        this.videoControlReceiver = new hybrid_udp.UDPServer;
        this.videoControlReceiver.name = 'VideoControl';
        this.videoControlReceiver.on('packet', (function(_this) {
          return function(buf, addr, port) {
            var streamId;
            logger.info("[custom_receiver] started receiving video");
            if (buf.length >= 5) {
              streamId = buf.toString('utf8', 4);
            } else {
              streamId = "public";
            }
            _this.setInternalStreamId(streamId);
            return callback.videoControl(_this.getInternalStream(), buf.slice(3));
          };
        })(this));
        this.audioControlReceiver = new hybrid_udp.UDPServer;
        this.audioControlReceiver.name = 'AudioControl';
        this.audioControlReceiver.on('packet', (function(_this) {
          return function(buf, addr, port) {
            logger.info("[custom_receiver] started receiving audio");
            return callback.audioControl(_this.getInternalStream(), buf.slice(3));
          };
        })(this));
        this.videoDataReceiver = new hybrid_udp.UDPServer;
        this.videoDataReceiver.name = 'VideoData';
        this.videoDataReceiver.on('packet', (function(_this) {
          return function(buf, addr, port) {
            return callback.videoData(_this.getInternalStream(), buf.slice(3));
          };
        })(this));
        this.audioDataReceiver = new hybrid_udp.UDPServer;
        this.audioDataReceiver.name = 'AudioData';
        this.audioDataReceiver.on('packet', (function(_this) {
          return function(buf, addr, port) {
            return callback.audioData(_this.getInternalStream(), buf.slice(3));
          };
        })(this));
      } else {
        throw new Error("unknown receiver type: " + this.type);
      }
    }

    CustomReceiver.prototype.getInternalStream = function() {
      var streamId;
      if (this.internalStream == null) {
        logger.warn('[rtsp] warn: Internal stream name not known; using default "public"');
        streamId = 'public';
        this.internalStream = avstreams.getOrCreate(streamId);
      }
      return this.internalStream;
    };

    CustomReceiver.prototype.setInternalStreamId = function(streamId) {
      var stream;
      if ((this.internalStream != null) && (this.internalStream.id !== streamId)) {
        avstreams.remove(this.internalStream);
      }
      logger.info("[rtsp] internal stream name has been set to: " + streamId);
      stream = avstreams.get(streamId);
      if (stream != null) {
        logger.info("[rtsp] resetting existing stream");
        stream.reset();
      } else {
        stream = avstreams.create(streamId);
      }
      return this.internalStream = stream;
    };

    CustomReceiver.prototype.start = function() {
      if (this.type === 'unix') {
        return this.startUnix();
      } else if (this.type === 'tcp') {
        return this.startTCP();
      } else if (this.type === 'udp') {
        return this.startUDP();
      } else {
        throw new Error("unknown receiverType in config: " + this.type);
      }
    };

    CustomReceiver.prototype.startUnix = function() {
      this.videoControlReceiver.listen(config.videoControlReceiverPath, function() {
        fs.chmodSync(config.videoControlReceiverPath, '777');
        return logger.debug("[" + TAG + "] videoControl socket: " + config.videoControlReceiverPath);
      });
      this.audioControlReceiver.listen(config.audioControlReceiverPath, function() {
        fs.chmodSync(config.audioControlReceiverPath, '777');
        return logger.debug("[" + TAG + "] audioControl socket: " + config.audioControlReceiverPath);
      });
      this.videoDataReceiver.listen(config.videoDataReceiverPath, function() {
        fs.chmodSync(config.videoDataReceiverPath, '777');
        return logger.debug("[" + TAG + "] videoData socket: " + config.videoDataReceiverPath);
      });
      return this.audioDataReceiver.listen(config.audioDataReceiverPath, function() {
        fs.chmodSync(config.audioDataReceiverPath, '777');
        return logger.debug("[" + TAG + "] audioData socket: " + config.audioDataReceiverPath);
      });
    };

    CustomReceiver.prototype.startTCP = function() {
      this.videoControlReceiver.listen(config.videoControlReceiverPort, config.receiverListenHost, config.receiverTCPBacklog, function() {
        return logger.debug("[" + TAG + "] videoControl socket: tcp:" + config.videoControlReceiverPort);
      });
      this.audioControlReceiver.listen(config.audioControlReceiverPort, config.receiverListenHost, config.receiverTCPBacklog, function() {
        return logger.debug("[" + TAG + "] audioControl socket: tcp:" + config.audioControlReceiverPort);
      });
      this.videoDataReceiver.listen(config.videoDataReceiverPort, config.receiverListenHost, config.receiverTCPBacklog, function() {
        return logger.debug("[" + TAG + "] videoData socket: tcp:" + config.videoDataReceiverPort);
      });
      return this.audioDataReceiver.listen(config.audioDataReceiverPort, config.receiverListenHost, config.receiverTCPBacklog, function() {
        return logger.debug("[" + TAG + "] audioData socket: tcp:" + config.audioDataReceiverPort);
      });
    };

    CustomReceiver.prototype.startUDP = function() {
      this.videoControlReceiver.start(config.videoControlReceiverPort, config.receiverListenHost, function() {
        return logger.debug("[" + TAG + "] videoControl socket: udp:" + config.videoControlReceiverPort);
      });
      this.audioControlReceiver.start(config.audioControlReceiverPort, config.receiverListenHost, function() {
        return logger.debug("[" + TAG + "] audioControl socket: udp:" + config.audioControlReceiverPort);
      });
      this.videoDataReceiver.start(config.videoDataReceiverPort, config.receiverListenHost, function() {
        return logger.debug("[" + TAG + "] videoData socket: udp:" + config.videoDataReceiverPort);
      });
      return this.audioDataReceiver.start(config.audioDataReceiverPort, config.receiverListenHost, function() {
        return logger.debug("[" + TAG + "] audioData socket: udp:" + config.audioDataReceiverPort);
      });
    };

    CustomReceiver.prototype.deleteReceiverSocketsSync = function() {
      var e;
      if (this.type === 'unix') {
        if (fs.existsSync(config.videoControlReceiverPath)) {
          try {
            fs.unlinkSync(config.videoControlReceiverPath);
          } catch (_error) {
            e = _error;
            logger.error("unlink error: " + e);
          }
        }
        if (fs.existsSync(config.audioControlReceiverPath)) {
          try {
            fs.unlinkSync(config.audioControlReceiverPath);
          } catch (_error) {
            e = _error;
            logger.error("unlink error: " + e);
          }
        }
        if (fs.existsSync(config.videoDataReceiverPath)) {
          try {
            fs.unlinkSync(config.videoDataReceiverPath);
          } catch (_error) {
            e = _error;
            logger.error("unlink error: " + e);
          }
        }
        if (fs.existsSync(config.audioDataReceiverPath)) {
          try {
            fs.unlinkSync(config.audioDataReceiverPath);
          } catch (_error) {
            e = _error;
            logger.error("unlink error: " + e);
          }
        }
      }
    };

    CustomReceiver.prototype.createReceiver = function(name, callback) {
      return net.createServer((function(_this) {
        return function(c) {
          var buf;
          logger.info("[custom_receiver] new connection to " + name);
          buf = null;
          c.on('close', function() {
            return logger.info("[custom_receiver] connection to " + name + " closed");
          });
          return c.on('data', function(data) {
            var payloadSize, streamId, totalSize;
            if (config.debug.dropAllData) {
              return;
            }
            if (buf != null) {
              buf = Buffer.concat([buf, data]);
            } else {
              buf = data;
            }
            if (buf.length >= 3) {
              while (true) {
                payloadSize = buf[0] * 0x10000 + buf[1] * 0x100 + buf[2];
                totalSize = payloadSize + 3;
                if (buf.length >= totalSize) {
                  if (name === 'VideoControl') {
                    if (buf.length >= 5) {
                      streamId = buf.toString('utf8', 4, totalSize);
                    } else {
                      streamId = "public";
                    }
                    _this.setInternalStreamId(streamId);
                  }
                  callback(_this.getInternalStream(), buf.slice(3, totalSize));
                  if (buf.length > totalSize) {
                    buf = buf.slice(totalSize);
                  } else {
                    buf = null;
                    break;
                  }
                } else {
                  break;
                }
              }
            }
          });
        };
      })(this));
    };

    return CustomReceiver;

  })();

  module.exports = CustomReceiver;

}).call(this);
