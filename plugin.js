/**!
 * @file PGMMV Storage Plugin
 * @author Tristan Bonsor <kidthales@agogpixel.com>
 * @copyright 2026 Tristan Bonsor
 * @license {@link https://opensource.org/licenses/MIT MIT License}
 * @version 0.1.4
 */
// noinspection ES6ConvertVarToLetConst
(function () {
  // noinspection UnnecessaryLocalVariableJS
  /** @type {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkPlugin} */
  var plugin = {
      setLocale: function () {},
      getInfo: function (category) {
        switch (category) {
          case 'name':
            return 'PGMMV Storage Plugin';
          case 'description':
            return 'Save/load switch and variable values to/from a file.';
          case 'author':
            return 'Tristan Bonsor <kidthales@agogpixel.com>';
          case 'help':
            return (
              "This plugin provides a way to save/load game data without PGMMV's file slot\n" +
              'system. Suitable for high scores, achievements, statistics, and any other global\n' +
              'data.\n' +
              '\n' +
              'Values are stored in the "' +
              kStorageFilename +
              '" file located in the directory specified\n' +
              'by the `Agtk.settings.projectPath` value.\n' +
              '\n' +
              'Usually you will want to save/load Project Common switches and variables.\n' +
              'However, object instance values may also be saved; these can then be loaded by\n' +
              'other object instances of the same kind.'
            );
          case 'parameter':
            return [];
          case 'internal':
            // Internal data managed from storage file.
            return null;
          case 'actionCommand':
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
      initialize: function () {
        if (isEditor()) {
          return;
        }

        if (!io) {
          io = createIO();
        }

        if (!window.kt) {
          window.kt = {};
        }

        window.kt.storage = {
          saveVariable: saveVariable,
          loadVariable: loadVariable,
          saveSwitch: saveSwitch,
          loadSwitch: loadSwitch
        };
      },
      finalize: function () {
        io = undefined;
      },
      setParamValue: function () {},
      setInternal: function () {
        // Do nothing; internal data set from storage file.
      },
      call: function () {},
      update: function () {
        if (isError) {
          if (isShutdownMessageShown) {
            return;
          }

          logError('deactivating plugin');
          isShutdownMessageShown = true;
          return;
        }

        io && io.update();
      },
      execActionCommand: function (actionCommandIndex, parameter, objectId, instanceId) {
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
            return saveVariable(np[actionCommand.parameter[0].id], np[actionCommand.parameter[1].id], instanceId);
          case loadVariableActionCommand.id:
            return loadVariable(np[actionCommand.parameter[0].id], np[actionCommand.parameter[1].id], instanceId);
          case saveSwitchActionCommand.id:
            return saveSwitch(np[actionCommand.parameter[0].id], np[actionCommand.parameter[1].id], instanceId);
          case loadSwitchActionCommand.id:
            return loadSwitch(np[actionCommand.parameter[0].id], np[actionCommand.parameter[1].id], instanceId);
          default:
            break;
        }

        return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorNext;
      }
    },
    /** @const */
    kStorageFilename = 'kt_store.json',
    /** @const */
    kVariableAccessorType = 0,
    /** @const */
    kSwitchAccessorType = 1,
    /** @type {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkActionCommand} */
    saveVariableActionCommand = {
      id: 0,
      name: 'Save Variable [PGMMV Storage Plugin]',
      description: 'Save variable to storage.',
      parameter: [
        {
          id: 100,
          name: 'Variable Source',
          type: 'SwitchVariableObjectId',
          option: ['SelfObject', 'ParentObject'],
          defaultValue: -1
        },
        {
          id: 0,
          name: 'Variable',
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
          name: 'Variable Source',
          type: 'SwitchVariableObjectId',
          option: ['SelfObject', 'ParentObject'],
          defaultValue: -1
        },
        {
          id: 0,
          name: 'Variable',
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
          name: 'Switch Source',
          type: 'SwitchVariableObjectId',
          option: ['SelfObject', 'ParentObject'],
          defaultValue: -1
        },
        {
          id: 0,
          name: 'Switch',
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
      description: 'Load switch from storage.',
      parameter: [
        {
          id: 100,
          name: 'Switch Source',
          type: 'SwitchVariableObjectId',
          option: ['SelfObject', 'ParentObject'],
          defaultValue: -1
        },
        {
          id: 0,
          name: 'Switch',
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
    /** @type {boolean} */
    isShutdownMessageShown = false,
    /** @type {{requestSave: () => void; update: () => void;}} */
    io,
    /**
     * @param variableObjectId {
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ProjectCommon'] |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['SelfObject'] |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ParentObject']
     * }
     * @param variableId {number}
     * @param instanceId {number}
     * @returns {import("pgmmv-types/lib/agtk/constants/action-commands/command-behavior").AgtkCommandBehavior['CommandBehaviorNext']}
     */
    saveVariable = function (variableObjectId, variableId, instanceId) {
      var source = resolveSwitchVariableObject(variableObjectId, instanceId);

      if (source === Agtk.constants.actionCommands.UnsetObject) {
        logWarning('save variable: unset variable source');
      } else if (variableId < 1) {
        logWarning('save variable: invalid variable ID');
      } else {
        setInternalData(source, variableId, 'variables');
      }

      return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorNext;
    },
    /**
     * @param variableObjectId {
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ProjectCommon'] |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['SelfObject'] |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ParentObject']
     * }
     * @param variableId {number}
     * @param instanceId {number}
     * @returns {
     *   import("pgmmv-types/lib/agtk/constants/action-commands/command-behavior").AgtkCommandBehavior['CommandBehaviorNext'] |
     *   import("pgmmv-types/lib/agtk/constants/action-commands/command-behavior").AgtkCommandBehavior['CommandBehaviorBlock']
     * }
     */
    loadVariable = function (variableObjectId, variableId, instanceId) {
      var projectCommon = Agtk.constants.switchVariableObjects.ProjectCommon,
        /**
         * @type {
         *   import("pgmmv-types/lib/agtk/object-instances/object-instance").AgtkObjectInstance |
         *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ProjectCommon'] |
         *   import("pgmmv-types/lib/agtk/constants/action-commands").AgtkActionCommands['UnsetObject']
         * }
         */
        source,
        /** @type {string} */
        key;

      if (!isInternalDataLoaded) {
        return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorBlock;
      }

      source = resolveSwitchVariableObject(variableObjectId, instanceId);

      if (source === Agtk.constants.actionCommands.UnsetObject) {
        logWarning('load variable: unset variable source');
      } else if (variableId < 1) {
        logWarning('load variable: invalid variable ID');
      } else {
        key = generateKey(source === projectCommon ? source : source.objectId, kVariableAccessorType, variableId);

        if (internalData[key] !== undefined) {
          // Load the variable!
          if (source === projectCommon) {
            Agtk.variables.get(variableId).setValue(internalData[key]);
          } else {
            source.execCommandSwitchVariableChange({
              swtch: false,
              variableObjectId: source.objectId,
              variableQualifierId: Agtk.constants.qualifier.QualifierWhole,
              variableId: variableId,
              variableAssignOperator: Agtk.constants.assignments.VariableAssignOperatorSet,
              assignValue: internalData[key]
            });
          }
        }
      }

      return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorNext;
    },
    /**
     * @param switchObjectId {
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ProjectCommon'] |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['SelfObject'] |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ParentObject']
     * }
     * @param switchId {number}
     * @param instanceId {number}
     * @returns {import("pgmmv-types/lib/agtk/constants/action-commands/command-behavior").AgtkCommandBehavior['CommandBehaviorNext']}
     */
    saveSwitch = function (switchObjectId, switchId, instanceId) {
      var source = resolveSwitchVariableObject(switchObjectId, instanceId);

      if (source === Agtk.constants.actionCommands.UnsetObject) {
        logWarning('save switch: unset switch source');
      } else if (switchId < 1) {
        logWarning('save switch: invalid switch ID');
      } else {
        setInternalData(source, switchId, 'switches');
      }

      return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorNext;
    },
    /**
     * @param switchObjectId {
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ProjectCommon'] |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['SelfObject'] |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ParentObject']
     * }
     * @param switchId {number}
     * @param instanceId {number}
     * @returns {
     *   import("pgmmv-types/lib/agtk/constants/action-commands/command-behavior").AgtkCommandBehavior['CommandBehaviorNext'] |
     *   import("pgmmv-types/lib/agtk/constants/action-commands/command-behavior").AgtkCommandBehavior['CommandBehaviorBlock']
     * }
     */
    loadSwitch = function (switchObjectId, switchId, instanceId) {
      var projectCommon = Agtk.constants.switchVariableObjects.ProjectCommon,
        /**
         * @type {
         *   import("pgmmv-types/lib/agtk/object-instances/object-instance").AgtkObjectInstance |
         *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ProjectCommon'] |
         *   import("pgmmv-types/lib/agtk/constants/action-commands").AgtkActionCommands['UnsetObject']
         * }
         */
        source,
        /** @type {string} */
        key;

      if (!isInternalDataLoaded) {
        return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorBlock;
      }

      source = resolveSwitchVariableObject(switchObjectId, instanceId);

      if (source === Agtk.constants.actionCommands.UnsetObject) {
        logWarning('load switch: unset switch source');
      } else if (switchId < 1) {
        logWarning('load switch: invalid switch ID');
      } else {
        key = generateKey(source === projectCommon ? source : source.objectId, kSwitchAccessorType, switchId);

        if (internalData[key] !== undefined) {
          // Load the switch!
          if (source === projectCommon) {
            Agtk.switches.get(switchId).setValue(internalData[key]);
          } else {
            source.execCommandSwitchVariableChange({
              swtch: true,
              switchObjectId: source.objectId,
              switchQualifierId: Agtk.constants.qualifier.QualifierWhole,
              switchId: switchId,
              switchValue: internalData[key]
            });
          }
        }
      }

      return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorNext;
    },
    /**
     * @param switchVariableObjectId {
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ProjectCommon'] |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['SelfObject'] |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ParentObject']
     * }
     * @param instanceId {number}
     * @returns {
     *   import("pgmmv-types/lib/agtk/object-instances/object-instance").AgtkObjectInstance |
     *   import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ProjectCommon'] |
     *   import("pgmmv-types/lib/agtk/constants/action-commands").AgtkActionCommands['UnsetObject']
     * }
     */
    resolveSwitchVariableObject = function (switchVariableObjectId, instanceId) {
      var instance = Agtk.objectInstances.get(instanceId),
        pId;

      switch (switchVariableObjectId) {
        case Agtk.constants.switchVariableObjects.ProjectCommon:
          return switchVariableObjectId;
        case Agtk.constants.switchVariableObjects.SelfObject:
          return instance;
        case Agtk.constants.switchVariableObjects.ParentObject:
          pId = instance.variables.get(Agtk.constants.objects.variables.ParentObjectInstanceIDId).getValue();

          if (pId !== Agtk.constants.actionCommands.UnsetObject) {
            return Agtk.objectInstances.get(pId);
          }

          break;
        default:
          break;
      }

      return Agtk.constants.actionCommands.UnsetObject;
    },
    /**
     * @param switchOrVariableSource {import("pgmmv-types/lib/agtk/object-instances/object-instance").AgtkObjectInstance|import("pgmmv-types/lib/agtk/constants/switch-variable-objects").AgtkSwitchVariableObjects['ProjectCommon']}
     * @param switchOrVariableId {number}
     * @param type {'variables' | 'switches'}
     */
    setInternalData = function (switchOrVariableSource, switchOrVariableId, type) {
      var projectCommon = Agtk.constants.switchVariableObjects.ProjectCommon,
        key = generateKey(
          switchOrVariableSource === projectCommon ? switchOrVariableSource : switchOrVariableSource.objectId,
          type === 'switches' ? kSwitchAccessorType : kVariableAccessorType,
          switchOrVariableId
        ),
        accessor =
          switchOrVariableSource === projectCommon
            ? Agtk[type].get(switchOrVariableId)
            : switchOrVariableSource[type].get(switchOrVariableId);

      internalData[key] = accessor.getValue();

      io.requestSave();
    },
    /** @type {(objectId: number, accessorType: number, accessorId: number) => string} */
    generateKey = function (objectId, accessorType, accessorId) {
      return objectId + ',' + accessorType + ',' + accessorId;
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
    },
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
    };

  return plugin;
})();
