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
            return {};
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
      initialize: function (data) {
        if (isEditor()) {
          return;
        }

        // TODO
        Agtk.log('Initialize ' + plugin.getInfo('name'));
      },
      finalize: function () {},
      setParamValue: function (paramValue) {},
      setInternal: function (data) {},
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
          // TODO
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
    /**
     * @returns {boolean}
     */
    isEditor = function () {
      return !Agtk || typeof Agtk.log !== 'function';
    },
    /**
     * @param paramValue Parameter values to normalize.
     * @param defaults Default parameter values available.
     * @returns {Record<number, import("type-fest").JsonValue>}
     */
    normalizeParameters = function (
      /** @type {import("pgmmv-types/lib/agtk/plugins/plugin").AgtkParameterValue[]} */
      paramValue,
      /** @type {import("pgmmv-types/lib/agtk/plugins/plugin/parameter").AgtkParameter[]} */
      defaults
    ) {
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
    /** @type {boolean} */
    isError = false;

  return plugin;
})();
