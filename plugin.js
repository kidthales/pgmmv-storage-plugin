/**!
 * @file PGMMV Storage Plugin
 * @author Tristan Bonsor <kidthales@agogpixel.com>
 * @copyright 2026 Tristan Bonsor
 * @license {@link https://opensource.org/licenses/MIT MIT License}
 * @version 0.2.0
 */
/// <reference types="@kidthales/pgmmv-types/pgmmv.d.ts" />
// noinspection ES6ConvertVarToLetConst
(function () {
  // noinspection UnnecessaryLocalVariableJS
  /** @type {import("@kidthales/pgmmv-types").AgtkPlugin} */
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
      /** @type {import("@kidthales/pgmmv-types").AgtkActionCommand} */
      var actionCommand,
        /** @type {Record<number, import("@kidthales/pgmmv-types").AgtkParameterValue['value']>} */
        np,
        /** @type {import("@kidthales/pgmmv-types").AgtkParameterValue['value']} */
        rawObjId,
        /** @type {import("@kidthales/pgmmv-types").AgtkParameterValue['value']} */
        rawItemId,
        /** @type {import("@kidthales/pgmmv-types").Agtk['constants']['switchVariableObjects']['ProjectCommon' | 'SelfObject' | 'ParentObject'] | import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['UnsetObject']} */
        svObjId,
        /** @type {number} */
        svId;

      if (isError) {
        logWarning('plugin deactivated due to previous error - skipping action command');
        return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorNext;
      }

      actionCommand = /** @type {import("@kidthales/pgmmv-types").AgtkPluginInfoResult<'actionCommand'>} */ (
        plugin.getInfo('actionCommand')
      )[actionCommandIndex];
      np = normalizeParameters(parameter, actionCommand.parameter);
      rawObjId = np[actionCommand.parameter[0].id];
      rawItemId = np[actionCommand.parameter[1].id];
      svObjId =
        rawObjId === Agtk.constants.switchVariableObjects.ProjectCommon ||
        rawObjId === Agtk.constants.switchVariableObjects.SelfObject ||
        rawObjId === Agtk.constants.switchVariableObjects.ParentObject
          ? rawObjId
          : Agtk.constants.actionCommands.UnsetObject;
      svId = typeof rawItemId === 'number' ? rawItemId : -1;

      switch (actionCommand.id) {
        case saveVariableActionCommand.id:
          return saveVariable(svObjId, svId, instanceId);
        case loadVariableActionCommand.id:
          return loadVariable(svObjId, svId, instanceId);
        case saveSwitchActionCommand.id:
          return saveSwitch(svObjId, svId, instanceId);
        case loadSwitchActionCommand.id:
          return loadSwitch(svObjId, svId, instanceId);
        default:
          break;
      }

      return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorNext;
    }
  };

  /** @const */
  var kStorageFilename = 'kt_store.json',
    /** @const */
    kVariableAccessorType = 0,
    /** @const */
    kSwitchAccessorType = 1;

  /** @type {import("@kidthales/pgmmv-types").AgtkActionCommand} */
  var saveVariableActionCommand = {
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
    /** @type {import("@kidthales/pgmmv-types").AgtkActionCommand} */
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
    /** @type {import("@kidthales/pgmmv-types").AgtkActionCommand} */
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
    /** @type {import("@kidthales/pgmmv-types").AgtkActionCommand} */
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
    /** @type {Record<string, unknown>} */
    internalData = {},
    /** @type {boolean} */
    isInternalDataLoaded = false,
    /** @type {boolean} */
    isError = false,
    /** @type {boolean} */
    isShutdownMessageShown = false;

  /** @type {{requestSave: () => void; update: () => void;} | undefined} */
  var io;

  /**
   * @param {number} id
   * @returns {boolean}
   */
  var isValidId = function (id) {
    return typeof id === 'number' && isFinite(id) && id >= 1 && id % 1 === 0;
  };

  /**
   * @param {import("@kidthales/pgmmv-types").Agtk['constants']['switchVariableObjects']['ProjectCommon' | 'SelfObject' | 'ParentObject'] | import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['UnsetObject']} variableObjectId
   * @param {number} variableId
   * @param {number} instanceId
   * @returns {import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['commandBehavior']['CommandBehaviorNext']}
   */
  var saveVariable = function (variableObjectId, variableId, instanceId) {
    var source = resolveSwitchVariableObject(variableObjectId, instanceId);

    if (source === Agtk.constants.actionCommands.UnsetObject) {
      logWarning('save variable: unset variable source');
    } else if (!isValidId(variableId)) {
      logWarning('save variable: invalid variable ID');
    } else {
      setInternalData(source, variableId, 'variables');
    }

    return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorNext;
  };

  /**
   * @param {import("@kidthales/pgmmv-types").Agtk['constants']['switchVariableObjects']['ProjectCommon' | 'SelfObject' | 'ParentObject'] | import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['UnsetObject']} variableObjectId
   * @param {number} variableId
   * @param {number} instanceId
   * @returns {import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['commandBehavior']['CommandBehaviorNext' | 'CommandBehaviorBlock']}
   */
  var loadVariable = function (variableObjectId, variableId, instanceId) {
    var projectCommon = Agtk.constants.switchVariableObjects.ProjectCommon,
      /** @type {ReturnType<import("@kidthales/pgmmv-types").Agtk['objectInstances']['get']> | import("@kidthales/pgmmv-types").Agtk['constants']['switchVariableObjects']['ProjectCommon'] | import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['UnsetObject']} */
      source,
      /** @type {string} */
      key,
      /** @type {unknown} */
      val,
      /** @type {number} */
      numVal,
      /** @type {ReturnType<import("@kidthales/pgmmv-types").Agtk['variables']['get']> | null | undefined} */
      variable;

    if (!isInternalDataLoaded) {
      return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorBlock;
    }

    source = resolveSwitchVariableObject(variableObjectId, instanceId);

    if (source === Agtk.constants.actionCommands.UnsetObject) {
      logWarning('load variable: unset variable source');
    } else if (!isValidId(variableId)) {
      logWarning('load variable: invalid variable ID');
    } else {
      key = generateKey(source === projectCommon ? source : source.objectId, kVariableAccessorType, variableId);
      val = internalData[key];

      if (val !== undefined) {
        numVal = typeof val === 'number' || (typeof val === 'string' && val.trim() !== '') ? Number(val) : NaN;

        if (!isFinite(numVal)) {
          logWarning('load variable: invalid variable value for key "' + key + '"');
        } else if (source === projectCommon) {
          variable = Agtk.variables.get(variableId);

          if (!variable) {
            logWarning('load variable: missing variable accessor for ID ' + variableId);
          } else {
            variable.setValue(numVal);
          }
        } else {
          source.execCommandSwitchVariableChange({
            swtch: false,
            switchObjectId: Agtk.constants.actionCommands.UnsetObject,
            switchQualifierId: Agtk.constants.qualifier.QualifierSingle,
            switchId: Agtk.constants.actionCommands.UnsetObject,
            switchValue: Agtk.constants.assignments.SwitchAssignOn,
            variableObjectId: source.objectId,
            variableQualifierId: Agtk.constants.qualifier.QualifierWhole,
            variableId: variableId,
            variableAssignOperator: Agtk.constants.assignments.VariableAssignOperatorSet,
            variableAssignValueType: Agtk.constants.assignments.VariableAssignValue,
            assignValue: numVal,
            assignVariableObjectId: Agtk.constants.actionCommands.UnsetObject,
            assignVariableQualifierId: Agtk.constants.qualifier.QualifierSingle,
            assignVariableId: Agtk.constants.actionCommands.UnsetObject,
            randomMin: 0,
            randomMax: 0
          });
        }
      }
    }

    return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorNext;
  };

  /**
   * @param {import("@kidthales/pgmmv-types").Agtk['constants']['switchVariableObjects']['ProjectCommon' | 'SelfObject' | 'ParentObject'] | import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['UnsetObject']} switchObjectId
   * @param {number} switchId
   * @param {number} instanceId
   * @returns {import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['commandBehavior']['CommandBehaviorNext']}
   */
  var saveSwitch = function (switchObjectId, switchId, instanceId) {
    var source = resolveSwitchVariableObject(switchObjectId, instanceId);

    if (source === Agtk.constants.actionCommands.UnsetObject) {
      logWarning('save switch: unset switch source');
    } else if (!isValidId(switchId)) {
      logWarning('save switch: invalid switch ID');
    } else {
      setInternalData(source, switchId, 'switches');
    }

    return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorNext;
  };

  /**
   * @param {import("@kidthales/pgmmv-types").Agtk['constants']['switchVariableObjects']['ProjectCommon' | 'SelfObject' | 'ParentObject'] | import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['UnsetObject']} switchObjectId
   * @param {number} switchId
   * @param {number} instanceId
   * @returns {import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['commandBehavior']['CommandBehaviorNext' | 'CommandBehaviorBlock']}
   */
  var loadSwitch = function (switchObjectId, switchId, instanceId) {
    var projectCommon = Agtk.constants.switchVariableObjects.ProjectCommon,
      /** @type {ReturnType<import("@kidthales/pgmmv-types").Agtk['objectInstances']['get']> | import("@kidthales/pgmmv-types").Agtk['constants']['switchVariableObjects']['ProjectCommon'] | import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['UnsetObject']} */
      source,
      /** @type {string} */
      key,
      /** @type {unknown} */
      val,
      /** @type {boolean} */
      boolVal,
      /** @type {ReturnType<import("@kidthales/pgmmv-types").Agtk['switches']['get']> | null | undefined} */
      swtch;

    if (!isInternalDataLoaded) {
      return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorBlock;
    }

    source = resolveSwitchVariableObject(switchObjectId, instanceId);

    if (source === Agtk.constants.actionCommands.UnsetObject) {
      logWarning('load switch: unset switch source');
    } else if (!isValidId(switchId)) {
      logWarning('load switch: invalid switch ID');
    } else {
      key = generateKey(source === projectCommon ? source : source.objectId, kSwitchAccessorType, switchId);
      val = internalData[key];

      if (val !== undefined) {
        if (typeof val === 'boolean') {
          boolVal = val;
        } else if (typeof val === 'number' && isFinite(val)) {
          boolVal = Boolean(val);
        } else {
          logWarning('load switch: invalid switch value for key "' + key + '"');
          return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorNext;
        }

        // Load the switch!
        if (source === projectCommon) {
          swtch = Agtk.switches.get(switchId);

          if (!swtch) {
            logWarning('load switch: missing switch accessor for ID ' + switchId);
          } else {
            swtch.setValue(boolVal);
          }
        } else {
          source.execCommandSwitchVariableChange({
            swtch: true,
            switchObjectId: source.objectId,
            switchQualifierId: Agtk.constants.qualifier.QualifierWhole,
            switchId: switchId,
            switchValue: boolVal
              ? Agtk.constants.assignments.SwitchAssignOn
              : Agtk.constants.assignments.SwitchAssignOff,
            variableObjectId: Agtk.constants.actionCommands.UnsetObject,
            variableQualifierId: Agtk.constants.qualifier.QualifierSingle,
            variableId: Agtk.constants.actionCommands.UnsetObject,
            variableAssignOperator: Agtk.constants.assignments.VariableAssignOperatorSet,
            variableAssignValueType: Agtk.constants.assignments.VariableAssignValue,
            assignValue: 0,
            assignVariableObjectId: Agtk.constants.actionCommands.UnsetObject,
            assignVariableQualifierId: Agtk.constants.qualifier.QualifierSingle,
            assignVariableId: Agtk.constants.actionCommands.UnsetObject,
            randomMin: 0,
            randomMax: 0
          });
        }
      }
    }

    return Agtk.constants.actionCommands.commandBehavior.CommandBehaviorNext;
  };

  /**
   * @param {import("@kidthales/pgmmv-types").Agtk['constants']['switchVariableObjects']['ProjectCommon' | 'SelfObject' | 'ParentObject'] | import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['UnsetObject']} switchVariableObjectId
   * @param {number} instanceId
   * @returns {ReturnType<import("@kidthales/pgmmv-types").Agtk['objectInstances']['get']> | import("@kidthales/pgmmv-types").Agtk['constants']['switchVariableObjects']['ProjectCommon'] | import("@kidthales/pgmmv-types").Agtk['constants']['actionCommands']['UnsetObject']}
   */
  var resolveSwitchVariableObject = function (switchVariableObjectId, instanceId) {
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
  };

  /**
   * @param {ReturnType<import("@kidthales/pgmmv-types").Agtk['objectInstances']['get']> | import("@kidthales/pgmmv-types").Agtk['constants']['switchVariableObjects']['ProjectCommon']} switchOrVariableSource
   * @param {number} switchOrVariableId
   * @param {'variables' | 'switches'} type
   */
  var setInternalData = function (switchOrVariableSource, switchOrVariableId, type) {
    var projectCommon = Agtk.constants.switchVariableObjects.ProjectCommon,
      key = generateKey(
        switchOrVariableSource === projectCommon ? switchOrVariableSource : switchOrVariableSource.objectId,
        type === 'switches' ? kSwitchAccessorType : kVariableAccessorType,
        switchOrVariableId
      ),
      accessor =
        switchOrVariableSource === projectCommon
          ? Agtk[type].get(switchOrVariableId)
          : switchOrVariableSource[type]
            ? switchOrVariableSource[type].get(switchOrVariableId)
            : null;

    if (!accessor) {
      logWarning(
        (type === 'switches'
          ? 'save switch: missing switch accessor for ID '
          : 'save variable: missing variable accessor for ID ') + switchOrVariableId
      );
      return;
    }

    internalData[key] = accessor.getValue();

    io && io.requestSave();
  };

  /** @type {(objectId: number, accessorType: number, accessorId: number) => string} */
  var generateKey = function (objectId, accessorType, accessorId) {
      return objectId + ',' + accessorType + ',' + accessorId;
    },
    /** @type {(msg: string) => void} */
    logError = function (msg) {
      if (isEditor()) {
        return;
      }

      Agtk.log('[ERROR][' + plugin.getInfo('name') + '] ' + msg);
    },
    /** @type {(msg: string) => void} */
    logWarning = function (msg) {
      if (isEditor()) {
        return;
      }

      Agtk.log('[WARNING][' + plugin.getInfo('name') + '] ' + msg);
    },
    /** @type {() => {requestSave: () => void; update: () => void;}} */
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

                  if (typeof jsbResult !== 'string' || !cc.isString(jsbResult)) {
                    logError('failed reading data from ' + kStoragePath);
                    isError = true;
                    return;
                  }

                  try {
                    parsedData = JSON.parse(jsbResult);
                  } catch (e) {
                    logError('failed parsing data from ' + kStoragePath);
                    isError = true;
                    return;
                  }

                  if (!cc.isObject(parsedData) || parsedData === null || Array.isArray(parsedData)) {
                    logError('invalid data type parsed from ' + kStoragePath);
                    isError = true;
                    return;
                  }

                  internalData = /** @type {Record<string, unknown>} */ (parsedData);
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
        /** @type {unknown} */
        parsedData,
        /** @type {string} */
        json,
        /** @type {number} */
        fileSize,
        /** @type {number} */
        jsonSize,
        /** @type {(str: string) => number} */
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

  /**
   * @returns {boolean}
   */
  var isEditor = function () {
    return !Agtk || typeof Agtk.log !== 'function';
  };

  /**
   * @param {import("@kidthales/pgmmv-types").AgtkParameterValue[]} paramValue Parameter values to normalize.
   * @param {import("@kidthales/pgmmv-types").AgtkParameter[]} defaults Default parameter values available.
   * @returns {Record<number, import("@kidthales/pgmmv-types").AgtkParameterValue['value']>}
   */
  var normalizeParameters = function (paramValue, defaults) {
    /** @type {Record<number, import("@kidthales/pgmmv-types").AgtkParameterValue['value']>} */
    var normalized = {},
      /** @type {number} */
      len = defaults.length,
      /** @type {number} */
      i = 0,
      /** @type {import("@kidthales/pgmmv-types").AgtkParameter} */
      d,
      /** @type {import("@kidthales/pgmmv-types").AgtkParameterValue} */
      p;

    for (; i < len; ++i) {
      d = defaults[i];
      normalized[d.id] =
        d.type === 'Json'
          ? JSON.stringify(d.defaultValue)
          : /** @type {import("@kidthales/pgmmv-types").AgtkParameterValue['value']} */ (d.defaultValue);
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
