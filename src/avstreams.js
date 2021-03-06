// Generated by CoffeeScript 1.7.1
(function() {
  var AVStream, EventEmitterModule, api, eventListeners, h264, logger, streams,
    __slice = [].slice;

  h264 = require('./h264');

  EventEmitterModule = require('./event_emitter');

  logger = require('./logger');

  AVStream = (function() {
    function AVStream(id) {
      this.id = id;
      this.initAVParams();
    }

    AVStream.prototype.initAVParams = function() {
      this.audioClockRate = null;
      this.audioSampleRate = null;
      this.audioChannels = null;
      this.audioPeriodSize = 1024;
      this.audioObjectType = null;
      this.videoWidth = null;
      this.videoHeight = null;
      this.videoProfileLevelId = null;
      this.videoFrameRate = 30.0;
      this.videoAVCLevel = null;
      this.videoAVCProfile = null;
      this.isVideoStarted = false;
      this.isAudioStarted = false;
      this.timeAtVideoStart = null;
      this.timeAtAudioStart = null;
      this.spsString = '';
      this.ppsString = '';
      this.spsNALUnit = null;
      this.ppsNALUnit = null;
      return this.spropParameterSets = '';
    };

    AVStream.prototype.reset = function() {
      logger.debug("[stream:" + this.id + "] reset");
      this.initAVParams();
      return this.emit('reset');
    };

    AVStream.prototype.updateSpropParam = function(buf) {
      var nalUnitType;
      nalUnitType = buf[0] & 0x1f;
      if (nalUnitType === 7) {
        this.spsString = buf.toString('base64');
        this.videoProfileLevelId = buf.slice(1, 4).toString('hex').toUpperCase();
      } else if (nalUnitType === 8) {
        this.ppsString = buf.toString('base64');
      }
      return this.spropParameterSets = this.spsString + ',' + this.ppsString;
    };

    AVStream.prototype.resetFrameRate = function() {
      this.frameRateCalcBasePTS = null;
      this.frameRateCalcNumFrames = null;
      return this.videoFrameRate = 30.0;
    };

    AVStream.prototype.calcFrameRate = function(pts) {
      var diffMs, frameRate;
      if (this.frameRateCalcBasePTS != null) {
        diffMs = (pts - this.frameRateCalcBasePTS) / 90;
        this.frameRateCalcNumFrames++;
        if ((this.frameRateCalcNumFrames >= 150) || (diffMs >= 5000)) {
          frameRate = this.frameRateCalcNumFrames * 1000 / diffMs;
          if (frameRate !== this.videoFrameRate) {
            logger.debug("[stream:" + this.id + "] frame rate: " + this.videoFrameRate);
            this.videoFrameRate = frameRate;
            this.emit('update_frame_rate', frameRate);
          }
          this.frameRateCalcBasePTS = pts;
          return this.frameRateCalcNumFrames = 0;
        }
      } else {
        this.frameRateCalcBasePTS = pts;
        return this.frameRateCalcNumFrames = 0;
      }
    };

    AVStream.prototype.updateConfig = function(obj) {
      var isConfigUpdated, name, value;
      isConfigUpdated = false;
      for (name in obj) {
        value = obj[name];
        if (this[name] !== value) {
          this[name] = value;
          if (value instanceof Buffer) {
            logger.debug("[stream:" + this.id + "] update " + name + ": Buffer=<0x" + (value.toString('hex')) + ">");
          } else if (typeof value === 'object') {
            logger.debug("[stream:" + this.id + "] update " + name + ":");
            logger.debug(value);
          } else {
            logger.debug("[stream:" + this.id + "] update " + name + ": " + value);
          }
          if (name === 'audioASCInfo') {
            if (value.sbrPresentFlag === 1) {
              if (value.psPresentFlag === 1) {
                logger.debug("[stream:" + this.id + "] audio: HE-AAC v2");
              } else {
                logger.debug("[stream:" + this.id + "] audio: HE-AAC v1");
              }
            }
          }
          isConfigUpdated = true;
        }
      }
      if (isConfigUpdated) {
        return this.emit('updateConfig');
      }
    };

    AVStream.prototype.updateSPS = function(nalUnit) {
      var e, frameSize, isConfigUpdated, sps;
      if ((this.spsNALUnit == null) || (nalUnit.compare(this.spsNALUnit) !== 0)) {
        this.spsNALUnit = nalUnit;
        this.updateSpropParam(nalUnit);
        try {
          sps = h264.readSPS(nalUnit);
        } catch (_error) {
          e = _error;
          logger.error("[stream:" + this.id + "] video data error: failed to read SPS");
          logger.error(e.stack);
          return;
        }
        frameSize = h264.getFrameSize(sps);
        isConfigUpdated = false;
        if (this.videoWidth !== frameSize.width) {
          this.videoWidth = frameSize.width;
          logger.debug("[stream:" + this.id + "] video width: " + this.videoWidth);
          isConfigUpdated = true;
        }
        if (this.videoHeight !== frameSize.height) {
          this.videoHeight = frameSize.height;
          logger.debug("[stream:" + this.id + "] video height: " + this.videoHeight);
          isConfigUpdated = true;
        }
        if (this.videoAVCLevel !== sps.level_idc) {
          this.videoAVCLevel = sps.level_idc;
          logger.debug("[stream:" + this.id + "] video avclevel: " + this.videoAVCLevel);
          isConfigUpdated = true;
        }
        if (this.videoAVCProfile !== sps.profile_idc) {
          this.videoAVCProfile = sps.profile_idc;
          logger.debug("[stream:" + this.id + "] video avcprofile: " + this.videoAVCProfile);
          isConfigUpdated = true;
        }
        if (isConfigUpdated) {
          logger.debug("[stream:" + this.id + "] updated SPS");
          return this.emit('updateConfig');
        }
      }
    };

    AVStream.prototype.updatePPS = function(nalUnit) {
      if ((this.ppsNALUnit == null) || (nalUnit.compare(this.ppsNALUnit) !== 0)) {
        logger.debug("[stream:" + this.id + "] updated PPS");
        this.ppsNALUnit = nalUnit;
        this.updateSpropParam(nalUnit);
        return this.emit('updateConfig');
      }
    };

    AVStream.prototype.toString = function() {
      var str;
      str = "" + this.id + ": ";
      if (this.videoWidth != null) {
        str += "video: " + this.videoWidth + "x" + this.videoHeight + " profile=" + this.videoAVCProfile + " level=" + this.videoAVCLevel;
      } else {
        str += "video: (waiting for data)";
      }
      if (this.audioSampleRate != null) {
        str += "; audio: samplerate=" + this.audioSampleRate + " channels=" + this.audioChannels + " objecttype=" + this.audioObjectType;
      } else {
        str += "; audio: (waiting for data)";
      }
      return str;
    };

    return AVStream;

  })();

  EventEmitterModule.mixin(AVStream);

  eventListeners = {};

  streams = {};

  api = {
    AVStream: AVStream,
    emit: function() {
      var data, listener, name, _i, _len, _ref;
      name = arguments[0], data = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      if (eventListeners[name] != null) {
        _ref = eventListeners[name];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          listener = _ref[_i];
          listener.apply(null, data);
        }
      }
    },
    on: function(name, listener) {
      if (eventListeners[name] != null) {
        return eventListeners[name].push(listener);
      } else {
        return eventListeners[name] = [listener];
      }
    },
    removeListener: function(name, listener) {
      var i, _i, _len, _listener, _ref, _ref1;
      if (eventListeners[name] != null) {
        _ref = eventListeners[name];
        for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
          _listener = _ref[i];
          if (_listener === listener) {
            [].splice.apply(eventListeners, [i, i - i + 1].concat(_ref1 = [])), _ref1;
          }
        }
      }
    },
    getAll: function() {
      return streams;
    },
    exists: function(streamId) {
      return streams[streamId] != null;
    },
    get: function(streamId) {
      return streams[streamId];
    },
    create: function(streamId) {
      var stream;
      stream = new AVStream(streamId);
      api.emit('new', stream);
      api.add(stream);
      return stream;
    },
    getOrCreate: function(streamId) {
      var stream;
      stream = streams[streamId];
      if (stream == null) {
        stream = api.create(streamId);
      }
      return stream;
    },
    add: function(stream) {
      if (streams[stream.id] != null) {
        logger.warn("warning: overwriting stream: " + stream.id);
      }
      streams[stream.id] = stream;
      api.emit('add_stream', stream);
      stream._onAnyListener = (function(stream) {
        return function() {
          var data, eventName;
          eventName = arguments[0], data = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
          return api.emit.apply(api, [eventName, stream].concat(__slice.call(data)));
        };
      })(stream);
      return stream.onAny(stream._onAnyListener);
    },
    remove: function(streamId) {
      var stream;
      if (typeof streamId === 'object') {
        stream = streamId;
        streamId = stream != null ? stream.id : void 0;
      } else {
        stream = streams[streamId];
      }
      if (stream != null) {
        stream.offAny(stream._onAnyListener);
        api.emit('remove_stream', stream);
      }
      return delete streams[streamId];
    },
    clear: function() {
      streams = {};
      return api.emit('clear_streams');
    },
    dump: function() {
      var stream, streamId, _results;
      logger.raw("[streams: " + (Object.keys(streams).length) + "]");
      _results = [];
      for (streamId in streams) {
        stream = streams[streamId];
        _results.push(logger.raw(" " + stream.toString()));
      }
      return _results;
    }
  };

  module.exports = api;

}).call(this);
