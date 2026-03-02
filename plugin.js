/**
 * @file PGMMV Storage Plugin
 * @author Tristan Bonsor <kidthales@agogpixel.com>
 * @license MIT
 * @version 0.1.0
 */
// noinspection ES6ConvertVarToLetConst
(function () {
  // noinspection UnnecessaryLocalVariableJS
  /**
   * @type {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkPlugin}
   */
  var plugin = {
      setLocale: function (locale) {},
      getInfo: function (category) {
        switch (category) {
          case 'name':
            return 'PGMMV Storage Plugin';
          case 'description':
            return 'Read/write switch and variable values to/from a file.';
          case 'author':
            return 'Tristan Bonsor <kidthales@agogpixel.com>';
          case 'help':
            return (
              'Values are stored in the "' +
              kStorageFilename +
              '" file located in the directory specified by the `Agtk.settings.projectPath` value.' +
              '\n\n' +
              'Values from objects are mapped by object ID.'
            );
          case 'parameter':
            return [];
          case 'internal':
            // Internal data managed from storage file.
            return null;
          case 'actionCommand':
            // Do not change the order!
            return [
              saveVariableActionCommand,
              loadVariableActionCommand,
              saveSwitchActionCommand,
              loadSwitchActionCommand
            ];
          case 'linkCondition':
            return [];
          default:
            break;
        }
      },
      initialize: function (data) {
        if (isEditor()) {
          return;
        }

        // TODO
        Agtk.log('Initialize ' + plugin.getInfo('name'));
      },
      finalize: function () {},
      setParamValue: function (paramValue) {},
      setInternal: function (data) {
        // Do nothing; internal data set from storage file.
      },
      call: function () {},
      update: function (delta) {
        // TODO
      },
      execActionCommand: function (
        actionCommandIndex,
        parameter,
        objectId,
        instanceId,
        actionId,
        commandId,
        commonActionStatus,
        sceneId
      ) {
        /**
         * @type {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkActionCommand}
         */
        var actionCommand,
          /** @type {Record<number,import("type-fest").JsonValue>} */
          np;

        if (isError) {
          logWarning('plugin deactivated due to previous error - skipping action command');
          return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorNext;
        }

        actionCommand = plugin.getInfo('actionCommand')[actionCommandIndex];
        np = normalizeParameters(parameter, actionCommand.parameter);

        switch (actionCommand.id) {
          case saveVariableActionCommand.id:
          // TODO
          case loadVariableActionCommand.id:
          // TODO
          case saveSwitchActionCommand.id:
          // TODO
          case loadSwitchActionCommand.id:
          // TODO
          default:
            break;
        }

        return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorNext;
      }
    },
    /** @const */
    kStorageFilename = 'kt_store.json',
    /** @type {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkActionCommand} */
    saveVariableActionCommand = {
      id: 0,
      name: 'Save Variable [PGMMV Storage Plugin]',
      description: 'Save variable to storage.',
      parameter: [
        {
          id: 100,
          name: 'Variable Source:',
          type: 'SwitchVariableObjectId',
          option: ['SelfObject', 'ParentObject'],
          defaultValue: -1
        },
        {
          id: 0,
          name: 'Variable:',
          type: 'VariableId',
          referenceId: 100,
          withNewButton: true,
          defaultValue: -1
        }
      ]
    },
    /** @type {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkActionCommand} */
    loadVariableActionCommand = {
      id: 1,
      name: 'Load Variable [PGMMV Storage Plugin]',
      description: 'Load variable from storage.',
      parameter: [
        {
          id: 100,
          name: 'Variable Source:',
          type: 'SwitchVariableObjectId',
          option: ['SelfObject', 'ParentObject'],
          defaultValue: -1
        },
        {
          id: 0,
          name: 'Variable:',
          type: 'VariableId',
          referenceId: 100,
          withNewButton: false,
          defaultValue: -1
        }
      ]
    },
    /** @type {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkActionCommand} */
    saveSwitchActionCommand = {
      id: 2,
      name: 'Save Switch [PGMMV Storage Plugin]',
      description: 'Save switch to storage.',
      parameter: [
        {
          id: 100,
          name: 'Switch Source:',
          type: 'SwitchVariableObjectId',
          option: ['SelfObject', 'ParentObject'],
          defaultValue: -1
        },
        {
          id: 0,
          name: 'Switch:',
          type: 'SwitchId',
          referenceId: 100,
          withNewButton: true,
          defaultValue: -1
        }
      ]
    },
    /** @type {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkActionCommand} */
    loadSwitchActionCommand = {
      id: 3,
      name: 'Load Switch [PGMMV Storage Plugin]',
      description: 'Load variable from storage.',
      parameter: [
        {
          id: 100,
          name: 'Switch Source:',
          type: 'SwitchVariableObjectId',
          option: ['SelfObject', 'ParentObject'],
          defaultValue: -1
        },
        {
          id: 0,
          name: 'Switch:',
          type: 'SwitchId',
          referenceId: 100,
          withNewButton: false,
          defaultValue: -1
        }
      ]
    },
    /** @type {import("type-fest").JsonValue} */
    internalData = {},
    /** @type {boolean} */
    isInternalDataLoaded = false,
    /** @type {boolean} */
    isError = false,
    /**
     * @returns {boolean}
     */
    isEditor = function () {
      return !Agtk || typeof Agtk.log !== 'function';
    },
    /**
     * @param paramValue {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkParameterValue[]} Parameter values to normalize.
     * @param defaults {import("pgmmv-types/lib/agtk/plugins/plugin/parameter").AgtkParameter[]} Default parameter values available.
     * @returns {Record<number, import("type-fest").JsonValue>}
     */
    normalizeParameters = function (paramValue, defaults) {
      /** @type {Record<number,import("type-fest").JsonValue>} */
      var normalized = {},
        /** @type {number} */
        len = defaults.length,
        /** @type {number} */
        i = 0,
        /** @type {import("pgmmv-types/lib/agtk/plugins/plugin/parameter").AgtkParameter|import("pgmmv-types/lib/agtk/plugins/plugin").AgtkParameterValue} */
        p;

      for (; i < len; ++i) {
        p = defaults[i];
        normalized[p.id] = p.type === 'Json' ? JSON.stringify(p.defaultValue) : p.defaultValue;
      }

      len = paramValue.length;

      for (i = 0; i < len; ++i) {
        p = paramValue[i];
        normalized[p.id] = p.value;
      }

      return normalized;
    },
    /** @type {(string) => void} */
    logError = function (msg) {
      if (isEditor()) {
        return;
      }

      Agtk.log('[ERROR][' + plugin.getInfo('name') + '] ' + msg);
    },
    /** @type {(string) => void} */
    logWarning = function (msg) {
      if (isEditor()) {
        return;
      }

      Agtk.log('[WARNING][' + plugin.getInfo('name') + '] ' + msg);
    },
    /** @type{() => {requestSave: () => void; update: () => void;}} */
    createIO = function () {
      // noinspection UnnecessaryLocalVariableJS
      /** @type {{requestSave: () => void; update: () => void;}} */
      var io = {
          requestSave: function () {
            isSaveRequested = true;
          },
          update: function () {
            switch (currentState) {
              case kInitState:
                if (jsb.fileUtils.isFileExist(kStoragePath)) {
                  jsbResult = jsb.fileUtils.getStringFromFile(kStoragePath);

                  if (!cc.isString(jsbResult)) {
                    logError('failed reading data from ' + kStoragePath);
                    isError = true;
                    return;
                  }

                  try {
                    internalData = JSON.parse(jsbResult);
                  } catch (e) {
                    logError('failed parsing data from ' + kStoragePath);
                    isError = true;
                    return;
                  }

                  if (!cc.isObject(internalData)) {
                    logError('invalid data type parsed from ' + kStoragePath);
                    isError = true;
                    return;
                  }
                }

                isInternalDataLoaded = true; // Load variable/switch action commands will stop blocking.
                currentState = kReadyState;
                break;
              case kReadyState:
                if (isSaveRequested) {
                  isSaveRequested = false;

                  try {
                    json = JSON.stringify(internalData);
                  } catch (e) {
                    logError('failed encoding data');
                    isError = true;
                    return;
                  }

                  jsonSize = getStringByteLength(json); // Get byte length of our encoding (for comparison with file size).
                  fileSize = jsb.fileUtils.getFileSize(kStoragePath);
                  jsbResult = jsb.fileUtils.writeStringToFile(json, kStoragePath);

                  if (!jsbResult) {
                    logError('failed writing data to ' + kStoragePath);
                    isError = true;
                    return;
                  }

                  currentState = kSaveState;
                }

                break;
              case kSaveState:
                // Polling for file write completion.
                if (fileSize !== jsonSize) {
                  // JSON encoding and previous file size does not match - we
                  // can test for new file size to indicate write completion.
                  if (jsonSize === jsb.fileUtils.getFileSize(kStoragePath)) {
                    currentState = kReadyState;
                  }
                } else if (json === jsb.fileUtils.getStringFromFile(kStoragePath)) {
                  // JSON encoding and previous file size matched so we need to
                  // compare content directly to indicate write completion.
                  currentState = kReadyState;
                }

                break;
              default:
                break;
            }
          }
        },
        /** @const */
        kInitState = -1,
        /** @const */
        kReadyState = 0,
        /** @const */
        kSaveState = 1,
        /** @const */
        kStoragePath = Agtk.settings.projectPath + '/' + kStorageFilename,
        /** @type {number} */
        currentState = kInitState,
        /** @type {boolean} */
        isSaveRequested = false,
        /** @type {string | boolean} */
        jsbResult,
        /** @type {string} */
        json,
        /** @type {number} */
        fileSize,
        /** @type {number} */
        jsonSize,
        /** @type {(string) => number} */
        getStringByteLength = function (str) {
          var s = str.length,
            i = s - 1,
            /** @type {number} */
            code;

          for (; i >= 0; --i) {
            code = str.charCodeAt(i);

            if (code > 0x7f && code <= 0x7ff) {
              s++;
            } else if (code > 0x7ff && code <= 0xffff) {
              s += 2;
            }

            if (code >= 0xdc00 && code <= 0xdfff) {
              // Trail surrogate.
              i--;
            }
          }

          return s;
        };

      return io;
    };

  return plugin;
})();
