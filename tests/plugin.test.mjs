import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { assertSafeOutputPath, buildPlugin, resolveRealPath, stripComments } from '../scripts/build.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const pluginPath = path.join(ROOT, 'plugin.js');
const pluginSource = fs.readFileSync(pluginPath, 'utf8');
const buildScript = path.join(ROOT, 'scripts', 'build.mjs');
const eslintBin = path.join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');
const tscBin = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

const AGTK_CONSTANTS = {
  switchVariableObjects: {
    ProjectCommon: 0,
    SelfObject: -2,
    ParentObject: -7
  },
  actionCommands: {
    UnsetObject: -1,
    commandBehavior: {
      CommandBehaviorNext: 0,
      CommandBehaviorLoop: 1,
      CommandBehaviorBlock: 2,
      CommandBehaviorBreak: 3
    }
  },
  qualifier: {
    QualifierSingle: -1,
    QualifierWhole: -2
  },
  assignments: {
    SwitchAssignOn: 0,
    SwitchAssignOff: 1,
    SwitchAssignToggle: 2,
    VariableAssignOperatorSet: 0,
    VariableAssignValue: 0
  },
  objects: {
    variables: {
      ParentObjectInstanceIDId: 38
    }
  }
};

function loadPlugin(context = {}) {
  return vm.runInNewContext(pluginSource, context, { filename: 'plugin.js' });
}

function createAccessorStore(initial = {}, { returnUndefined = false } = {}) {
  const store = { ...initial };
  return {
    store,
    api: {
      get(id) {
        if (!(id in store) || store[id] === null || store[id] === undefined) {
          return returnUndefined ? undefined : null;
        }
        return {
          getValue() {
            return store[id];
          },
          setValue(value) {
            store[id] = value;
          }
        };
      }
    }
  };
}

function createMockEnv({
  projectPath = '/mock/project',
  projectVariables = {},
  projectSwitches = {},
  instances = {},
  files = {},
  returnUndefinedAccessors = false,
  fileUtilsOverrides = {}
} = {}) {
  const logs = [];
  const execChangeCalls = [];
  const virtualFiles = new Map(Object.entries(files));

  const projectVarStore = createAccessorStore(projectVariables, { returnUndefined: returnUndefinedAccessors });
  const projectSwitchStore = createAccessorStore(projectSwitches, { returnUndefined: returnUndefinedAccessors });

  const instanceStores = new Map();
  for (const [rawId, spec] of Object.entries(instances)) {
    const instanceId = Number(rawId);
    const varStore =
      spec.variables === null
        ? null
        : createAccessorStore(spec.variables ?? {}, { returnUndefined: returnUndefinedAccessors });
    const switchStore =
      spec.switches === null
        ? null
        : createAccessorStore(spec.switches ?? {}, { returnUndefined: returnUndefinedAccessors });
    instanceStores.set(instanceId, {
      objectId: spec.objectId,
      varStore,
      switchStore,
      api: {
        objectId: spec.objectId,
        variables: varStore ? varStore.api : null,
        switches: switchStore ? switchStore.api : null,
        execCommandSwitchVariableChange(payload) {
          execChangeCalls.push({ instanceId, ...payload });
          if (payload.swtch && switchStore) {
            switchStore.store[payload.switchId] = payload.switchValue === AGTK_CONSTANTS.assignments.SwitchAssignOn;
          } else if (!payload.swtch && varStore) {
            varStore.store[payload.variableId] = payload.assignValue;
          }
        }
      }
    });
  }

  const Agtk = {
    constants: AGTK_CONSTANTS,
    settings: {
      projectPath
    },
    log(message) {
      logs.push(message);
    },
    variables: projectVarStore.api,
    switches: projectSwitchStore.api,
    objectInstances: {
      get(instanceId) {
        return instanceStores.has(instanceId) ? instanceStores.get(instanceId).api : null;
      }
    }
  };

  const cc = {
    isString(value) {
      return typeof value === 'string';
    },
    isObject(value) {
      return typeof value === 'object' && value !== null;
    }
  };

  const jsb = {
    fileUtils: {
      isFileExist(filePath) {
        return virtualFiles.has(filePath);
      },
      getStringFromFile(filePath) {
        return virtualFiles.get(filePath) ?? '';
      },
      getFileSize(filePath) {
        if (!virtualFiles.has(filePath)) {
          return -1;
        }
        return Buffer.byteLength(virtualFiles.get(filePath), 'utf8');
      },
      writeStringToFile(content, filePath) {
        virtualFiles.set(filePath, content);
        return true;
      },
      ...fileUtilsOverrides
    }
  };

  const windowObj = {};

  return {
    Agtk,
    cc,
    jsb,
    window: windowObj,
    logs,
    execChangeCalls,
    virtualFiles,
    projectVars: projectVarStore.store,
    projectSwitches: projectSwitchStore.store,
    instanceStores,
    storagePath: `${projectPath}/kt_store.json`
  };
}

test('plugin.js evaluates to an object exposing all PGMMV plugin hooks', () => {
  const plugin = loadPlugin({});
  assert.equal(typeof plugin, 'object');
  assert.notEqual(plugin, null);

  for (const method of [
    'setLocale',
    'getInfo',
    'initialize',
    'finalize',
    'setParamValue',
    'setInternal',
    'call',
    'update',
    'execActionCommand'
  ]) {
    assert.equal(typeof plugin[method], 'function', `Expected ${method} to be a function`);
  }
});

test('getInfo returns expected metadata and actionCommand schemas for all categories', () => {
  const plugin = loadPlugin({});

  assert.equal(plugin.getInfo('name'), 'PGMMV Storage Plugin');
  assert.equal(plugin.getInfo('description'), 'Save/load switch and variable values to/from a file.');
  assert.equal(plugin.getInfo('author'), 'Tristan Bonsor <kidthales@agogpixel.com>');
  assert.match(plugin.getInfo('help'), /kt_store\.json/);
  assert.match(plugin.getInfo('help'), /Agtk\.settings\.projectPath/);
  assert.deepEqual(JSON.parse(JSON.stringify(plugin.getInfo('parameter'))), []);
  assert.equal(plugin.getInfo('internal'), null);
  assert.deepEqual(JSON.parse(JSON.stringify(plugin.getInfo('linkCondition'))), []);
  assert.equal(plugin.getInfo('invalid'), undefined);
  assert.equal(plugin.getInfo(''), undefined);

  const actionCommands = JSON.parse(JSON.stringify(plugin.getInfo('actionCommand')));
  assert.deepEqual(actionCommands, [
    {
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
    {
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
    {
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
    {
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
    }
  ]);
});

test('no-op hooks complete without throwing', () => {
  const plugin = loadPlugin({});

  assert.doesNotThrow(() => {
    plugin.setLocale('en');
    plugin.setParamValue([]);
    plugin.setInternal(null);
    plugin.call();
    plugin.update(16);
    plugin.finalize();
  });
});

test('initialize skips registering window.kt.storage in editor mode', () => {
  for (const agtkCandidate of [null, undefined, {}, { log: 'not-a-function' }]) {
    const windowObj = {};
    const plugin = loadPlugin({ Agtk: agtkCandidate, window: windowObj });
    assert.doesNotThrow(() => {
      plugin.initialize();
      plugin.update(16);
    });
    assert.equal('kt' in windowObj, false);
  }
});

test('initialize registers window.kt.storage outside editor and preserves existing window.kt keys', () => {
  const env = createMockEnv();
  const freshWindow = {};
  const pluginFresh = loadPlugin({ Agtk: env.Agtk, cc: env.cc, jsb: env.jsb, window: freshWindow });
  pluginFresh.initialize();

  assert.equal(typeof freshWindow.kt, 'object');
  assert.equal(typeof freshWindow.kt.storage, 'object');
  assert.equal(typeof freshWindow.kt.storage.saveVariable, 'function');
  assert.equal(typeof freshWindow.kt.storage.loadVariable, 'function');
  assert.equal(typeof freshWindow.kt.storage.saveSwitch, 'function');
  assert.equal(typeof freshWindow.kt.storage.loadSwitch, 'function');

  const existingWindow = { kt: { otherPlugin: { ready: true } } };
  const pluginExisting = loadPlugin({ Agtk: env.Agtk, cc: env.cc, jsb: env.jsb, window: existingWindow });
  pluginExisting.initialize();

  assert.deepEqual(existingWindow.kt.otherPlugin, { ready: true });
  assert.equal(typeof existingWindow.kt.storage.saveVariable, 'function');
});

test('loadVariable and loadSwitch block until initial update loads storage, then restore values', () => {
  const { ProjectCommon, SelfObject } = AGTK_CONSTANTS.switchVariableObjects;
  const { CommandBehaviorNext, CommandBehaviorBlock } = AGTK_CONSTANTS.actionCommands.commandBehavior;
  const { SwitchAssignOn, VariableAssignOperatorSet, VariableAssignValue } = AGTK_CONSTANTS.assignments;
  const { QualifierWhole } = AGTK_CONSTANTS.qualifier;

  const env = createMockEnv({
    projectVariables: { 5: 0 },
    projectSwitches: { 6: false },
    instances: {
      1: { objectId: 10, variables: { 7: 0 }, switches: { 8: false } }
    },
    files: {
      '/mock/project/kt_store.json': JSON.stringify({
        '0,0,5': 99,
        '0,1,6': true,
        '10,0,7': -12.5,
        '10,1,8': true
      })
    }
  });
  const plugin = loadPlugin({ Agtk: env.Agtk, cc: env.cc, jsb: env.jsb, window: env.window });
  plugin.initialize();

  // Before initial update, loads return CommandBehaviorBlock without mutating targets
  assert.equal(
    plugin.execActionCommand(
      1,
      [
        { id: 100, value: ProjectCommon },
        { id: 0, value: 5 }
      ],
      10,
      1
    ),
    CommandBehaviorBlock
  );
  assert.equal(
    plugin.execActionCommand(
      3,
      [
        { id: 100, value: ProjectCommon },
        { id: 0, value: 6 }
      ],
      10,
      1
    ),
    CommandBehaviorBlock
  );
  assert.equal(env.projectVars[5], 0);
  assert.equal(env.projectSwitches[6], false);

  // Initial update loads kt_store.json and unlocks loads
  plugin.update(16);

  assert.equal(
    plugin.execActionCommand(
      1,
      [
        { id: 100, value: ProjectCommon },
        { id: 0, value: 5 }
      ],
      10,
      1
    ),
    CommandBehaviorNext
  );
  assert.equal(
    plugin.execActionCommand(
      3,
      [
        { id: 100, value: ProjectCommon },
        { id: 0, value: 6 }
      ],
      10,
      1
    ),
    CommandBehaviorNext
  );
  assert.equal(env.projectVars[5], 99);
  assert.equal(env.projectSwitches[6], true);

  assert.equal(
    plugin.execActionCommand(
      1,
      [
        { id: 100, value: SelfObject },
        { id: 0, value: 7 }
      ],
      10,
      1
    ),
    CommandBehaviorNext
  );
  assert.equal(
    plugin.execActionCommand(
      3,
      [
        { id: 100, value: SelfObject },
        { id: 0, value: 8 }
      ],
      10,
      1
    ),
    CommandBehaviorNext
  );
  assert.equal(env.execChangeCalls.length, 2);
  assert.equal(env.execChangeCalls[0].swtch, false);
  assert.equal(env.execChangeCalls[0].variableObjectId, 10);
  assert.equal(env.execChangeCalls[0].variableQualifierId, QualifierWhole);
  assert.equal(env.execChangeCalls[0].variableId, 7);
  assert.equal(env.execChangeCalls[0].variableAssignOperator, VariableAssignOperatorSet);
  assert.equal(env.execChangeCalls[0].variableAssignValueType, VariableAssignValue);
  assert.equal(env.execChangeCalls[0].assignValue, -12.5);

  assert.equal(env.execChangeCalls[1].swtch, true);
  assert.equal(env.execChangeCalls[1].switchObjectId, 10);
  assert.equal(env.execChangeCalls[1].switchQualifierId, QualifierWhole);
  assert.equal(env.execChangeCalls[1].switchId, 8);
  assert.equal(env.execChangeCalls[1].switchValue, SwitchAssignOn);
});

test('save/load Action Commands and window.kt.storage persist ProjectCommon, SelfObject, and ParentObject state', () => {
  const { ProjectCommon, SelfObject, ParentObject } = AGTK_CONSTANTS.switchVariableObjects;
  const { UnsetObject } = AGTK_CONSTANTS.actionCommands;
  const { CommandBehaviorNext } = AGTK_CONSTANTS.actionCommands.commandBehavior;
  const { ParentObjectInstanceIDId } = AGTK_CONSTANTS.objects.variables;

  const env = createMockEnv({
    projectVariables: { 1: 42 },
    projectSwitches: { 2: true },
    instances: {
      1: {
        objectId: 10,
        variables: { 3: 77, [ParentObjectInstanceIDId]: 2 },
        switches: { 4: false }
      },
      2: {
        objectId: 20,
        variables: { 5: 314 },
        switches: { 6: true }
      },
      3: {
        objectId: 30,
        variables: { [ParentObjectInstanceIDId]: UnsetObject },
        switches: {}
      }
    }
  });
  const plugin = loadPlugin({ Agtk: env.Agtk, cc: env.cc, jsb: env.jsb, window: env.window });
  plugin.initialize();
  plugin.update(16); // kInitState -> kReadyState

  // Save ProjectCommon var 1 and switch 2 via Action Commands
  assert.equal(
    plugin.execActionCommand(
      0,
      [
        { id: 100, value: ProjectCommon },
        { id: 0, value: 1 }
      ],
      10,
      1
    ),
    CommandBehaviorNext
  );
  assert.equal(
    plugin.execActionCommand(
      2,
      [
        { id: 100, value: ProjectCommon },
        { id: 0, value: 2 }
      ],
      10,
      1
    ),
    CommandBehaviorNext
  );

  // Save SelfObject and ParentObject via window.kt.storage
  assert.equal(env.window.kt.storage.saveVariable(SelfObject, 3, 1), CommandBehaviorNext);
  assert.equal(env.window.kt.storage.saveSwitch(SelfObject, 4, 1), CommandBehaviorNext);
  assert.equal(env.window.kt.storage.saveVariable(ParentObject, 5, 1), CommandBehaviorNext);
  assert.equal(env.window.kt.storage.saveSwitch(ParentObject, 6, 1), CommandBehaviorNext);

  // Flush save: kReadyState -> kSaveState -> kReadyState (fileSize !== jsonSize path)
  plugin.update(16);
  plugin.update(16);

  const persisted = JSON.parse(env.virtualFiles.get(env.storagePath));
  assert.deepEqual(persisted, {
    '0,0,1': 42,
    '0,1,2': true,
    '10,0,3': 77,
    '10,1,4': false,
    '20,0,5': 314,
    '20,1,6': true
  });

  // Same-size overwrite path (fileSize === jsonSize): mutate variable 1 from 42 -> 99 (same JSON length)
  env.projectVars[1] = 99;
  env.window.kt.storage.saveVariable(ProjectCommon, 1, 1);
  plugin.update(16); // kReadyState -> kSaveState
  plugin.update(16); // kSaveState -> kReadyState via content comparison
  assert.equal(JSON.parse(env.virtualFiles.get(env.storagePath))['0,0,1'], 99);

  // Unset ParentObjectInstanceIDId warns and skips save
  const beforeLogs = env.logs.length;
  assert.equal(env.window.kt.storage.saveVariable(ParentObject, 5, 3), CommandBehaviorNext);
  assert.equal(env.window.kt.storage.loadSwitch(ParentObject, 6, 3), CommandBehaviorNext);
  assert.match(env.logs[beforeLogs], /\[WARNING\]\[PGMMV Storage Plugin\] save variable: unset variable source/);
  assert.match(env.logs[beforeLogs + 1], /\[WARNING\]\[PGMMV Storage Plugin\] load switch: unset switch source/);

  // Round-trip into a fresh plugin instance with zeroed runtime targets
  const env2 = createMockEnv({
    projectVariables: { 1: 0 },
    projectSwitches: { 2: false },
    instances: {
      1: {
        objectId: 10,
        variables: { 3: 0, [ParentObjectInstanceIDId]: 2 },
        switches: { 4: true }
      },
      2: {
        objectId: 20,
        variables: { 5: 0 },
        switches: { 6: false }
      }
    },
    files: {
      [env.storagePath]: env.virtualFiles.get(env.storagePath)
    }
  });
  const plugin2 = loadPlugin({ Agtk: env2.Agtk, cc: env2.cc, jsb: env2.jsb, window: env2.window });
  plugin2.initialize();
  plugin2.update(16);

  env2.window.kt.storage.loadVariable(ProjectCommon, 1, 1);
  env2.window.kt.storage.loadSwitch(ProjectCommon, 2, 1);
  env2.window.kt.storage.loadVariable(SelfObject, 3, 1);
  env2.window.kt.storage.loadSwitch(SelfObject, 4, 1);
  env2.window.kt.storage.loadVariable(ParentObject, 5, 1);
  env2.window.kt.storage.loadSwitch(ParentObject, 6, 1);

  assert.equal(env2.projectVars[1], 99);
  assert.equal(env2.projectSwitches[2], true);
  assert.equal(env2.instanceStores.get(1).varStore.store[3], 77);
  assert.equal(env2.instanceStores.get(1).switchStore.store[4], false);
  assert.equal(env2.instanceStores.get(2).varStore.store[5], 314);
  assert.equal(env2.instanceStores.get(2).switchStore.store[6], true);
  assert.deepEqual(env2.logs, []);
});

test('window.kt.storage and execActionCommand enforce fractional, out-of-range, non-numeric ID, and source guards', () => {
  const { ProjectCommon } = AGTK_CONSTANTS.switchVariableObjects;
  const { UnsetObject } = AGTK_CONSTANTS.actionCommands;
  const { CommandBehaviorNext } = AGTK_CONSTANTS.actionCommands.commandBehavior;

  const env = createMockEnv({
    projectVariables: { 1: 10 },
    projectSwitches: { 1: true },
    instances: { 1: { objectId: 10, variables: {}, switches: {} } },
    files: {
      '/mock/project/kt_store.json': JSON.stringify({
        '0,0,1.5': 99,
        '0,0,0': 99,
        '0,1,1.5': true,
        '0,1,0': true
      })
    }
  });
  const plugin = loadPlugin({ Agtk: env.Agtk, cc: env.cc, jsb: env.jsb, window: env.window });
  plugin.initialize();
  plugin.update(16);

  // Invalid / unset sources via Action Commands and script API
  assert.equal(plugin.execActionCommand(0, [], 10, 1), CommandBehaviorNext);
  assert.equal(
    plugin.execActionCommand(
      1,
      [
        { id: 100, value: 999 },
        { id: 0, value: 1 }
      ],
      10,
      1
    ),
    CommandBehaviorNext
  );
  assert.equal(env.window.kt.storage.saveSwitch(UnsetObject, 1, 1), CommandBehaviorNext);
  assert.equal(env.window.kt.storage.loadSwitch(999, 1, 1), CommandBehaviorNext);

  // Fractional, zero, negative, non-finite, and non-numeric IDs
  for (const badId of [0, -1, 1.5, 0.25, NaN, Infinity, -Infinity, '1', null, undefined]) {
    assert.equal(env.window.kt.storage.saveVariable(ProjectCommon, badId, 1), CommandBehaviorNext);
    assert.equal(env.window.kt.storage.loadVariable(ProjectCommon, badId, 1), CommandBehaviorNext);
    assert.equal(env.window.kt.storage.saveSwitch(ProjectCommon, badId, 1), CommandBehaviorNext);
    assert.equal(env.window.kt.storage.loadSwitch(ProjectCommon, badId, 1), CommandBehaviorNext);
  }

  // Non-numeric Action Command item ID parameter coerces to -1
  assert.equal(
    plugin.execActionCommand(
      0,
      [
        { id: 100, value: ProjectCommon },
        { id: 0, value: 'not-a-number' }
      ],
      10,
      1
    ),
    CommandBehaviorNext
  );

  assert.equal(env.logs.length, 45);
  assert.match(env.logs[0], /save variable: unset variable source/);
  assert.match(env.logs[1], /load variable: unset variable source/);
  assert.match(env.logs[2], /save switch: unset switch source/);
  assert.match(env.logs[3], /load switch: unset switch source/);
  assert.match(env.logs[4], /save variable: invalid variable ID/);
  assert.match(env.logs[5], /load variable: invalid variable ID/);
  assert.match(env.logs[6], /save switch: invalid switch ID/);
  assert.match(env.logs[7], /load switch: invalid switch ID/);

  // Ensure no save was requested by invalid operations
  plugin.update(16);
  assert.equal(JSON.parse(env.virtualFiles.get(env.storagePath))['0,0,1'], undefined);
});

test('save and load guard null/undefined variable and switch accessors with logWarning', () => {
  const { ProjectCommon, SelfObject } = AGTK_CONSTANTS.switchVariableObjects;
  const { CommandBehaviorNext } = AGTK_CONSTANTS.actionCommands.commandBehavior;

  for (const returnUndefinedAccessors of [false, true]) {
    const env = createMockEnv({
      projectVariables: {},
      projectSwitches: {},
      instances: {
        1: { objectId: 10, variables: {}, switches: {} },
        2: { objectId: 20, variables: null, switches: null }
      },
      returnUndefinedAccessors,
      files: {
        '/mock/project/kt_store.json': JSON.stringify({
          '0,0,50': 123,
          '0,1,51': true
        })
      }
    });
    const plugin = loadPlugin({ Agtk: env.Agtk, cc: env.cc, jsb: env.jsb, window: env.window });
    plugin.initialize();
    plugin.update(16);

    assert.equal(env.window.kt.storage.saveVariable(ProjectCommon, 50, 1), CommandBehaviorNext);
    assert.equal(env.window.kt.storage.saveSwitch(ProjectCommon, 51, 1), CommandBehaviorNext);
    assert.equal(env.window.kt.storage.loadVariable(ProjectCommon, 50, 1), CommandBehaviorNext);
    assert.equal(env.window.kt.storage.loadSwitch(ProjectCommon, 51, 1), CommandBehaviorNext);
    assert.equal(env.window.kt.storage.saveVariable(SelfObject, 52, 1), CommandBehaviorNext);
    assert.equal(env.window.kt.storage.saveSwitch(SelfObject, 53, 1), CommandBehaviorNext);
    assert.equal(env.window.kt.storage.saveVariable(SelfObject, 54, 2), CommandBehaviorNext);
    assert.equal(env.window.kt.storage.saveSwitch(SelfObject, 55, 2), CommandBehaviorNext);

    assert.deepEqual(env.logs, [
      '[WARNING][PGMMV Storage Plugin] save variable: missing variable accessor for ID 50',
      '[WARNING][PGMMV Storage Plugin] save switch: missing switch accessor for ID 51',
      '[WARNING][PGMMV Storage Plugin] load variable: missing variable accessor for ID 50',
      '[WARNING][PGMMV Storage Plugin] load switch: missing switch accessor for ID 51',
      '[WARNING][PGMMV Storage Plugin] save variable: missing variable accessor for ID 52',
      '[WARNING][PGMMV Storage Plugin] save switch: missing switch accessor for ID 53',
      '[WARNING][PGMMV Storage Plugin] save variable: missing variable accessor for ID 54',
      '[WARNING][PGMMV Storage Plugin] save switch: missing switch accessor for ID 55'
    ]);

    // Missing accessors must not overwrite persisted values or trigger file writes
    const persisted = JSON.parse(env.virtualFiles.get(env.storagePath));
    assert.deepEqual(persisted, { '0,0,50': 123, '0,1,51': true });
  }
});

test('loadVariable and loadSwitch handle JSON coercion and invalid value edge cases', () => {
  const { ProjectCommon } = AGTK_CONSTANTS.switchVariableObjects;

  const env = createMockEnv({
    projectVariables: { 1: 999, 2: 999, 3: 999, 10: 5, 11: 5, 12: 5, 13: 5, 14: 5, 15: 5, 16: 5, 17: 5, 18: 5 },
    projectSwitches: {
      1: false,
      2: true,
      3: false,
      4: false,
      5: true,
      10: true,
      11: true,
      12: true,
      13: true,
      14: true
    },
    files: {
      '/mock/project/kt_store.json': JSON.stringify({
        // Valid variable values (including numeric strings)
        '0,0,1': '42',
        '0,0,2': ' -3.5 ',
        '0,0,3': 0,
        // Invalid variable values
        '0,0,10': '',
        '0,0,11': '   ',
        '0,0,12': 'abc',
        '0,0,13': 'Infinity',
        '0,0,14': null,
        '0,0,15': true,
        '0,0,16': false,
        '0,0,17': [],
        '0,0,18': {},
        // Valid switch values (boolean & finite numbers)
        '0,1,1': true,
        '0,1,2': false,
        '0,1,3': 1,
        '0,1,4': -2,
        '0,1,5': 0,
        // Invalid switch values
        '0,1,10': 'true',
        '0,1,11': '1',
        '0,1,12': '',
        '0,1,13': null,
        '0,1,14': {}
      })
    }
  });
  const plugin = loadPlugin({ Agtk: env.Agtk, cc: env.cc, jsb: env.jsb, window: env.window });
  plugin.initialize();
  plugin.update(16);

  // Valid variable coercions
  env.window.kt.storage.loadVariable(ProjectCommon, 1, 1);
  env.window.kt.storage.loadVariable(ProjectCommon, 2, 1);
  env.window.kt.storage.loadVariable(ProjectCommon, 3, 1);
  assert.equal(env.projectVars[1], 42);
  assert.equal(env.projectVars[2], -3.5);
  assert.equal(env.projectVars[3], 0);

  // Missing key is silent no-op
  env.window.kt.storage.loadVariable(ProjectCommon, 999, 1);
  env.window.kt.storage.loadSwitch(ProjectCommon, 999, 1);
  assert.equal(env.logs.length, 0);

  // Invalid variable values warn and leave target untouched
  for (const id of [10, 11, 12, 13, 14, 15, 16, 17, 18]) {
    env.window.kt.storage.loadVariable(ProjectCommon, id, 1);
    assert.equal(env.projectVars[id], 5);
  }
  assert.equal(env.logs.length, 9);
  for (const msg of env.logs) {
    assert.match(msg, /\[WARNING\]\[PGMMV Storage Plugin\] load variable: invalid variable value for key "0,0,/);
  }

  // Valid switch coercions
  env.window.kt.storage.loadSwitch(ProjectCommon, 1, 1);
  env.window.kt.storage.loadSwitch(ProjectCommon, 2, 1);
  env.window.kt.storage.loadSwitch(ProjectCommon, 3, 1);
  env.window.kt.storage.loadSwitch(ProjectCommon, 4, 1);
  env.window.kt.storage.loadSwitch(ProjectCommon, 5, 1);
  assert.equal(env.projectSwitches[1], true);
  assert.equal(env.projectSwitches[2], false);
  assert.equal(env.projectSwitches[3], true);
  assert.equal(env.projectSwitches[4], true);
  assert.equal(env.projectSwitches[5], false);

  // Invalid switch values warn and leave target untouched
  const beforeSwitchWarns = env.logs.length;
  for (const id of [10, 11, 12, 13, 14]) {
    env.window.kt.storage.loadSwitch(ProjectCommon, id, 1);
    assert.equal(env.projectSwitches[id], true);
  }
  assert.equal(env.logs.length - beforeSwitchWarns, 5);
  for (let i = beforeSwitchWarns; i < env.logs.length; i++) {
    assert.match(env.logs[i], /\[WARNING\]\[PGMMV Storage Plugin\] load switch: invalid switch value for key "0,1,/);
  }
});

test('IO error states deactivate plugin cleanly and suppress duplicate deactivation errors', () => {
  const { ProjectCommon } = AGTK_CONSTANTS.switchVariableObjects;
  const { CommandBehaviorNext } = AGTK_CONSTANTS.actionCommands.commandBehavior;

  // 1. Non-string read result
  {
    const env = createMockEnv({
      files: { '/mock/project/kt_store.json': '{}' },
      fileUtilsOverrides: {
        getStringFromFile() {
          return null;
        }
      }
    });
    const plugin = loadPlugin({ Agtk: env.Agtk, cc: env.cc, jsb: env.jsb, window: env.window });
    plugin.initialize();
    plugin.update(16); // Logs failed reading data
    plugin.update(16); // Logs deactivating plugin
    plugin.update(16); // No duplicate deactivation log
    assert.equal(
      plugin.execActionCommand(
        0,
        [
          { id: 100, value: ProjectCommon },
          { id: 0, value: 1 }
        ],
        10,
        1
      ),
      CommandBehaviorNext
    );
    assert.deepEqual(env.logs, [
      '[ERROR][PGMMV Storage Plugin] failed reading data from /mock/project/kt_store.json',
      '[ERROR][PGMMV Storage Plugin] deactivating plugin',
      '[WARNING][PGMMV Storage Plugin] plugin deactivated due to previous error - skipping action command'
    ]);
  }

  // 2. Malformed JSON
  {
    const env = createMockEnv({
      files: { '/mock/project/kt_store.json': '{not-json' }
    });
    const plugin = loadPlugin({ Agtk: env.Agtk, cc: env.cc, jsb: env.jsb, window: env.window });
    plugin.initialize();
    plugin.update(16);
    assert.match(env.logs[0], /failed parsing data from/);
  }

  // 3. Non-plain-object JSON values (array, null, primitive)
  for (const invalidJson of ['[]', 'null', '"hello"', '42']) {
    const env = createMockEnv({
      files: { '/mock/project/kt_store.json': invalidJson }
    });
    const plugin = loadPlugin({ Agtk: env.Agtk, cc: env.cc, jsb: env.jsb, window: env.window });
    plugin.initialize();
    plugin.update(16);
    assert.match(env.logs[0], /invalid data type parsed from/);
  }

  // 4. Write failure
  {
    const env = createMockEnv({
      projectVariables: { 1: 7 },
      fileUtilsOverrides: {
        writeStringToFile() {
          return false;
        }
      }
    });
    const plugin = loadPlugin({ Agtk: env.Agtk, cc: env.cc, jsb: env.jsb, window: env.window });
    plugin.initialize();
    plugin.update(16);
    env.window.kt.storage.saveVariable(ProjectCommon, 1, 1);
    plugin.update(16);
    assert.match(env.logs[0], /failed writing data to/);
  }
});

test('IO getStringByteLength tracks UTF-8 multi-byte and surrogate pair byte lengths during kSaveState polling', () => {
  const { ProjectCommon } = AGTK_CONSTANTS.switchVariableObjects;
  // Include 2-byte (é), 3-byte (語), and 4-byte surrogate pair (🔑) characters in existing storage
  const initialData = { 'é語🔑': 1 };
  let writePollsRemaining = 1;
  const env = createMockEnv({
    projectVariables: { 1: 123 },
    files: {
      '/mock/project/kt_store.json': JSON.stringify(initialData)
    }
  });
  const baseGetFileSize = env.jsb.fileUtils.getFileSize;
  env.jsb.fileUtils.getFileSize = (filePath) => {
    if (writePollsRemaining > 0 && filePath === env.storagePath && env.virtualFiles.get(filePath)?.includes('0,0,1')) {
      writePollsRemaining--;
      return 0; // Simulate incomplete write on first kSaveState poll
    }
    return baseGetFileSize(filePath);
  };

  const plugin = loadPlugin({ Agtk: env.Agtk, cc: env.cc, jsb: env.jsb, window: env.window });
  plugin.initialize();
  plugin.update(16); // kInitState -> kReadyState

  env.window.kt.storage.saveVariable(ProjectCommon, 1, 1);
  plugin.update(16); // kReadyState -> kSaveState (writeStringToFile)
  plugin.update(16); // kSaveState poll 1 (file size 0 !== jsonSize -> stays in kSaveState)
  plugin.update(16); // kSaveState poll 2 (actual UTF-8 byte length === jsonSize -> kReadyState)

  // Save a second value to prove state returned to kReadyState and flushed cleanly
  env.projectVars[1] = 456;
  env.window.kt.storage.saveVariable(ProjectCommon, 1, 1);
  plugin.update(16);
  plugin.update(16);

  assert.deepEqual(JSON.parse(env.virtualFiles.get(env.storagePath)), {
    'é語🔑': 1,
    '0,0,1': 456
  });
  assert.deepEqual(env.logs, []);
});

test('scripts/build.mjs builds plugin.js preserving /**! banner and stripping JSDoc/line comments', () => {
  const distDir = path.join(ROOT, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  const distTmpDir = fs.mkdtempSync(path.join(distDir, '.tmp-build-out-'));
  try {
    const outFile = path.join(distTmpDir, 'bundle.js');
    const result = spawnSync(process.execPath, [buildScript, outFile], {
      cwd: ROOT,
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const built = fs.readFileSync(outFile, 'utf8');
    assert.match(built, /^\/\*\*![\s\S]*@version 0\.2\.0[\s\S]*\*\//);
    assert.doesNotMatch(built, /\/\/\/ <reference/);
    assert.doesNotMatch(built, /noinspection/);
    assert.doesNotMatch(built, /@param/);

    const env = createMockEnv({ projectVariables: { 1: 88 } });
    const plugin = vm.runInNewContext(
      built,
      { Agtk: env.Agtk, cc: env.cc, jsb: env.jsb, window: env.window },
      { filename: 'bundle.js' }
    );
    plugin.initialize();
    plugin.update(16);
    assert.equal(plugin.getInfo('name'), 'PGMMV Storage Plugin');
    assert.equal(typeof env.window.kt.storage.saveVariable, 'function');
    plugin.execActionCommand(
      0,
      [
        { id: 100, value: AGTK_CONSTANTS.switchVariableObjects.ProjectCommon },
        { id: 0, value: 1 }
      ],
      10,
      1
    );
    plugin.update(16);
    plugin.update(16);
    assert.deepEqual(JSON.parse(env.virtualFiles.get(env.storagePath)), { '0,0,1': 88 });
  } finally {
    fs.rmSync(distTmpDir, { recursive: true, force: true });
  }
});

test('buildPlugin emits default unscoped dist filename from package.json metadata', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pgmmv-build-fixture-'));
  try {
    fs.writeFileSync(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({ name: '@kidthales/sample-plugin', version: '1.2.3' }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tempRoot, 'plugin.js'),
      '/**!\n * @license MIT\n */\n// strip me\n(function () { return {}; })();\n',
      'utf8'
    );

    const outPath = await buildPlugin({ rootDir: tempRoot, cwd: tempRoot });
    assert.equal(path.basename(outPath), 'sample-plugin-v1.2.3.js');
    assert.equal(path.dirname(outPath), path.join(tempRoot, 'dist'));

    const built = fs.readFileSync(outPath, 'utf8');
    assert.match(built, /@license MIT/);
    assert.doesNotMatch(built, /strip me/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('scripts/build.mjs enforces self-overwrite and dist/ containment guards including symlinks', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pgmmv-build-guards-'));
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pgmmv-build-outside-'));
  try {
    const inputPath = path.join(tempRoot, 'plugin.js');
    const distDir = path.join(tempRoot, 'dist');
    fs.writeFileSync(inputPath, 'var x = 1;\n', 'utf8');
    fs.mkdirSync(distDir, { recursive: true });

    for (const target of [inputPath, path.join(distDir, '..', 'plugin.js')]) {
      assert.throws(
        () => assertSafeOutputPath({ rootDir: tempRoot, inputPath, distDir, outputPath: target }),
        /Refusing to overwrite input file/
      );
    }

    for (const target of [
      distDir,
      path.join(distDir, '.'),
      path.join(tempRoot, 'outside.js'),
      path.join(outsideDir, 'escape.js'),
      path.join(distDir, '..', 'outside.js')
    ]) {
      assert.throws(
        () => assertSafeOutputPath({ rootDir: tempRoot, inputPath, distDir, outputPath: target }),
        /Refusing to write outside dist directory/
      );
    }

    const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
    const rootAliasInDist = path.join(distDir, 'root-alias');
    fs.symlinkSync(tempRoot, rootAliasInDist, symlinkType);
    assert.throws(
      () =>
        assertSafeOutputPath({
          rootDir: tempRoot,
          inputPath,
          distDir,
          outputPath: path.join(rootAliasInDist, 'plugin.js')
        }),
      /Refusing to overwrite input file/
    );

    const escapeLinkInDist = path.join(distDir, 'escape-link');
    fs.symlinkSync(outsideDir, escapeLinkInDist, symlinkType);
    assert.throws(
      () =>
        assertSafeOutputPath({
          rootDir: tempRoot,
          inputPath,
          distDir,
          outputPath: path.join(escapeLinkInDist, 'out.js')
        }),
      /Refusing to write outside dist directory/
    );

    const cliFail = spawnSync(process.execPath, [buildScript, '../outside.js'], {
      cwd: ROOT,
      encoding: 'utf8'
    });
    assert.notEqual(cliFail.status, 0);
    assert.match(cliFail.stderr + cliFail.stdout, /Refusing to write outside dist directory/);

    const danglingLink = path.join(distDir, 'dangling-dir');
    fs.symlinkSync(path.join(outsideDir, 'missing-target'), danglingLink, symlinkType);
    assert.throws(() => resolveRealPath(danglingLink), { code: 'ENOENT' });
    assert.throws(() => resolveRealPath(path.join(danglingLink, 'nested', 'out.js')), { code: 'ENOENT' });
    assert.throws(
      () =>
        assertSafeOutputPath({
          rootDir: tempRoot,
          inputPath,
          distDir,
          outputPath: path.join(danglingLink, 'out.js')
        }),
      { code: 'ENOENT' }
    );

    const symlinkDistRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pgmmv-build-symdist-'));
    try {
      const symDistInput = path.join(symlinkDistRoot, 'plugin.js');
      const symDistDir = path.join(symlinkDistRoot, 'dist');
      fs.writeFileSync(symDistInput, 'var x = 1;\n', 'utf8');
      fs.symlinkSync(outsideDir, symDistDir, symlinkType);

      assert.throws(
        () =>
          assertSafeOutputPath({
            rootDir: symlinkDistRoot,
            inputPath: symDistInput,
            distDir: symDistDir,
            outputPath: path.join(symDistDir, 'out.js')
          }),
        /Refusing to write through non-canonical dist directory/
      );
    } finally {
      fs.rmSync(symlinkDistRoot, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('stripComments preserves ES5.1 §7.3 LineTerminator boundaries across CR, LS, and PS', () => {
  assert.equal(stripComments('return/*\r*/1;'), 'return\n1;');
  assert.equal(stripComments('return/*\u2028*/1;'), 'return\n1;');
  assert.equal(stripComments('return/*\u2029*/1;'), 'return\n1;');
  assert.equal(stripComments('var a/*inline*/=1;'), 'var a =1;');
  assert.equal(stripComments('var a = 1; // c\u2028var b = 2;'), 'var a = 1; \u2028var b = 2;');
  assert.equal(stripComments('var a = 1;\u2029'), 'var a = 1;\u2029');
});

test('stripComments rescans template literal braces and regex literals without stripping content', () => {
  const input = [
    'var a = `head ${ { k: 1 /* strip */ } } /* keep */ // keep`;',
    'var b = `m1 ${1} /* keep1 */ ${ `nested ${2} /* keep2 */` } // keep3`;',
    'var c = `div ${1}` / 2; // strip',
    'var r = /foo\\/\\*bar\\*\\/baz/g; /* strip */'
  ].join('\n');

  const output = stripComments(input);
  assert.match(output, /\/\* keep \*\/ \/\/ keep`/);
  assert.match(output, /\/\* keep1 \*\//);
  assert.match(output, /\/\* keep2 \*\//);
  assert.match(output, /\/\/ keep3`/);
  assert.match(output, /var c = `div \$\{1\}` \/ 2;/);
  assert.match(output, /var r = \/foo\\\/\\\*bar\\\*\\\/baz\/g;/);
  assert.doesNotMatch(output, /\/\* strip \*\//);
  assert.doesNotMatch(output, /\/\/ strip/);
});

test('stripComments and buildPlugin handle division after contextual/future-reserved identifiers and member keywords', async () => {
  const snippet = [
    '/**! @license MIT */',
    'var type = 10, out = 20, from = 4, set = 6, get = 8, of = 12, await = 14, yield = 16;',
    'var cfg = { default: 8, return: 10, await: 12 };',
    "var half = type / 2; // don't clip",
    "out /= 2; // don't break",
    "var mid = cfg.default / 2; // don't expose midpoint",
    "var opt = cfg?.return / 2; // don't break optional chaining",
    "var optAwait = cfg?.await / 2; // don't break member await",
    "var ratio = from / 2 + set / 2 + get / 2 + of / 2 + await / 2 + yield / 2; // don't leak",
    "var undef = undefined / 2; // don't break undefined",
    "for (var i = of / 2; i < 1; i++) {} // don't break for-init of"
  ].join('\n');

  const stripped = stripComments(snippet);
  assert.doesNotMatch(stripped, /don't/);
  assert.match(stripped, /var half = type \/ 2;/);
  assert.match(stripped, /out \/= 2;/);
  assert.match(stripped, /var mid = cfg\.default \/ 2;/);
  assert.match(stripped, /var opt = cfg\?\.return \/ 2;/);

  const es5BuildSnippet = [
    '/**! @license MIT */',
    'var type = 10, out = 20, from = 4, of = 12, await = 14, yield = 16;',
    'var cfg = { default: 8, return: 10 };',
    "var half = type / 2; // don't clip",
    "out /= 2; // don't break",
    "var mid = cfg.default / 2; // don't expose midpoint",
    "var ratio = from / 2 + of / 2 + await / 2 + yield / 2; // don't leak",
    "var ret = cfg.return / 2; // don't fail"
  ].join('\n');

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pgmmv-build-div-'));
  try {
    fs.writeFileSync(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({ name: '@kidthales/div-plugin', version: '0.2.0' }),
      'utf8'
    );
    fs.writeFileSync(path.join(tempRoot, 'plugin.js'), es5BuildSnippet, 'utf8');

    const outPath = await buildPlugin({ rootDir: tempRoot, cwd: tempRoot });
    const built = fs.readFileSync(outPath, 'utf8');
    assert.doesNotMatch(built, /don't/);
    assert.match(built, /type \/ 2/);
    assert.match(built, /out \/= 2/);
    assert.match(built, /cfg\.default \/ 2/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('stripComments still rescans regex literals after for-of, async await, and generator yield', () => {
  const input = [
    'for (var x of /a\\/\\*keep\\*\\//g) {} /* strip */',
    'async function f() { return await /b\\/\\*keep\\*\\//g; /* strip */ }',
    'const g = async (x) => await /c\\/\\*keep\\*\\//g; /* strip */',
    'function* gen() { yield /d\\/\\*keep\\*\\//g; /* strip */ }',
    'async function outer() {',
    '  function inner() {',
    '    var await = 10;',
    "    return await / 2; // don't leak",
    '  }',
    '  return inner() && (await /e\\/\\*keep\\*\\//g); /* strip */',
    '}'
  ].join('\n');

  const output = stripComments(input);
  assert.match(output, /\/a\\\/\\\*keep\\\*\\\/\/g/);
  assert.match(output, /\/b\\\/\\\*keep\\\*\\\/\/g/);
  assert.match(output, /\/c\\\/\\\*keep\\\*\\\/\/g/);
  assert.match(output, /\/d\\\/\\\*keep\\\*\\\/\/g/);
  assert.match(output, /\/e\\\/\\\*keep\\\*\\\/\/g/);
  assert.doesNotMatch(output, /\/\* strip \*\//);
  assert.doesNotMatch(output, /don't leak/);
});

test('stripComments and buildPlugin handle statement-header regexes, prefix/postfix ++/--, and expression braces', async () => {
  const input = [
    'if (cond) /[//]/.test(s);',
    'var x = 1;',
    'if (cond) /[/*]/.test(s) && /[*/]/.test(s);',
    'while (cond) /[//]/.test(s);',
    'for (var i = 0; i < 1; i++) /[/*]/.test(s) && /[*/]/.test(s);',
    'with (obj) /[//]/.test(s);',
    'var callDiv = obj.if(cond) / 2; /* strip */',
    'var optCallDiv = obj?.while(cond) / 2; /* strip */',
    'var n = ++/[//]/.lastIndex;',
    'var y = 1;',
    'var sum = ++/[/*]/.lastIndex + --/[*/]/.lastIndex;',
    'a',
    '++/[//]/.lastIndex;',
    'a /*',
    '*/ --/[//]/.lastIndex;',
    '{ foo(); } ++/[//]/.lastIndex;',
    'if (cond) ++/[//]/.lastIndex;',
    'var postA = a++ / 2; /* strip */',
    'var postB = arr[i]-- / 2; /* strip */',
    'var postC = obj.default++ / 2; /* strip */',
    'var objDiv = { a: 1 } / 2; /* strip */',
    'var fnDiv = function () {} / 2; /* strip */',
    'var asyncFnDiv = async function () {} / 2; /* strip */',
    'var clsDiv = class {} / 2; /* strip */',
    'var ternDiv = cond ? { a: 1 } : { b: 2 } / 2; /* strip */',
    'var nestedObjDiv = { a: { b: 1 } / 2 }; /* strip */',
    'if (cond) { foo(); } /[//]/.test(s);',
    'function decl() {} /[/*]/.test(s) && /[*/]/.test(s);',
    'class Decl {} /[//]/.test(s);',
    'lbl: { foo(); } /[//]/.test(s);',
    'switch (v) { case 1: { foo(); } /[//]/.test(s); }',
    'const arrowBlock = () => {}',
    '/[//]/.test(s);'
  ].join('\n');

  const output = stripComments(input);
  assert.doesNotMatch(output, /\/\* strip \*\//);
  assert.match(output, /if \(cond\) \/\[\/\/\]\/\.test\(s\);/);
  assert.match(output, /if \(cond\) \/\[\/\*\]\/\.test\(s\) && \/\[(\*\/)\]\/\.test\(s\);/);
  assert.match(output, /while \(cond\) \/\[\/\/\]\/\.test\(s\);/);
  assert.match(output, /for \(var i = 0; i < 1; i\+\+\) \/\[\/\*\]\/\.test\(s\) && \/\[(\*\/)\]\/\.test\(s\);/);
  assert.match(output, /with \(obj\) \/\[\/\/\]\/\.test\(s\);/);
  assert.match(output, /var n = \+\+\/\[\/\/\]\/\.lastIndex;/);
  assert.match(output, /var sum = \+\+\/\[\/\*\]\/\.lastIndex \+ --\/\[(\*\/)\]\/\.lastIndex;/);
  assert.match(output, /a\n\+\+\/\[\/\/\]\/\.lastIndex;/);
  assert.match(output, /--\/\[\/\/\]\/\.lastIndex;/);
  assert.match(output, /\{ foo\(\); \} \+\+\/\[\/\/\]\/\.lastIndex;/);
  assert.match(output, /if \(cond\) \+\+\/\[\/\/\]\/\.lastIndex;/);
  assert.match(output, /var objDiv = \{ a: 1 \} \/ 2;/);
  assert.match(output, /var fnDiv = function \(\) \{\} \/ 2;/);
  assert.match(output, /if \(cond\) \{ foo\(\); \} \/\[\/\/\]\/\.test\(s\);/);
  assert.match(output, /function decl\(\) \{\} \/\[\/\*\]\/\.test\(s\) && \/\[(\*\/)\]\/\.test\(s\);/);
  assert.match(output, /class Decl \{\} \/\[\/\/\]\/\.test\(s\);/);
  assert.match(output, /lbl: \{ foo\(\); \} \/\[\/\/\]\/\.test\(s\);/);
  assert.match(output, /switch \(v\) \{ case 1: \{ foo\(\); \} \/\[\/\/\]\/\.test\(s\); \}/);
  assert.match(output, /const arrowBlock = \(\) => \{\}\n\/\[\/\/\]\/\.test\(s\);/);

  const es5BuildSnippet = [
    '/**! @license MIT */',
    'if (cond) /[//]/.test(s);',
    'var x = 1;',
    'if (cond) /[/*]/.test(s) && /[*/]/.test(s);',
    'var n = ++/[//]/.lastIndex;',
    'var y = 1;',
    'var objDiv = { a: 1 } / 2; /* strip */',
    'var fnDiv = function () {} / 2; /* strip */'
  ].join('\n');

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pgmmv-build-f1-'));
  try {
    fs.writeFileSync(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({ name: '@kidthales/f1-plugin', version: '0.2.0' }),
      'utf8'
    );
    fs.writeFileSync(path.join(tempRoot, 'plugin.js'), es5BuildSnippet, 'utf8');

    const outPath = await buildPlugin({ rootDir: tempRoot, cwd: tempRoot });
    const built = fs.readFileSync(outPath, 'utf8');
    assert.doesNotMatch(built, /\/\* strip \*\//);
    assert.match(built, /if \(cond\) \/\[\/\/\]\/\.test\(s\);/);
    assert.match(built, /if \(cond\) \/\[\/\*\]\/\.test\(s\) && \/\[(\*\/)\]\/\.test\(s\);/);
    assert.match(built, /var n = \+\+\/\[\/\/\]\/\.lastIndex;/);
    assert.match(built, /var objDiv = \{ a: 1 \} \/ 2;/);
    assert.match(built, /var fnDiv = function \(\) \{\} \/ 2;/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('stripComments handles member-keyword for-of LHS, ASI-terminated concise async arrows, and object methods', () => {
  const input = [
    'for (obj.default of /[/*]/.exec(s) || []) {} /* strip */',
    'for (obj.of of /[/*]/.exec(s) || []) {} /* strip */',
    'const f = async (x) => x',
    'var y = await / 2; /* strip */',
    'async function outer() {',
    '  var o = {',
    '    m() {',
    '      var await = 10;',
    '      return await / 2; /* strip */',
    '    }',
    '  };',
    '  return o;',
    '}'
  ].join('\n');

  const output = stripComments(input);
  assert.doesNotMatch(output, /\/\* strip \*\//);
  assert.match(output, /for \(obj\.default of \/\[\/\*\]\/\.exec\(s\) \|\| \[\]\)/);
  assert.match(output, /for \(obj\.of of \/\[\/\*\]\/\.exec\(s\) \|\| \[\]\)/);
  assert.match(output, /var y = await \/ 2;/);
  assert.match(output, /return await \/ 2;/);
});

test('stripComments and buildPlugin preserve regexes and divisions across nested for-headers, async blocks, template interpolations, and adjacent JSDoc banners', async () => {
  const input = [
    '/**!',
    ' * @license MIT',
    ' *//**',
    ' * @description strip me',
    ' */',
    'for (var f = function () { s = "a"; { s = "b"; } /[/*]/.test(s) && /[*/]/.test(s); }; false; ) {}',
    'for (var g = function () { s = "a"; { s = "b"; } /[//]/.test(s);',
    'var z = 1; }; false; ) {}',
    'for (let [x = function () { a(); }()] of /[/*]/.exec(s) && /[*/]/.exec(s)) {}',
    'async function outer() {',
    '  var async = function () {};',
    '  async()',
    '  { return await /[/*]/.test(s) && /[*/]/.test(s); }',
    '}',
    'var await = 10;',
    "var x = `${async () => 1}` && await / 2; // don't crash"
  ].join('\n');

  const output = stripComments(input);
  assert.match(output, /@license MIT/);
  assert.doesNotMatch(output, /@description strip me/);
  assert.doesNotMatch(output, /don't crash/);
  assert.match(output, /\{ s = "b"; \} \/\[\/\*\]\/\.test\(s\) && \/\[(\*\/)\]\/\.test\(s\);/);
  assert.match(output, /\{ s = "b"; \} \/\[\/\/\]\/\.test\(s\);\nvar z = 1;/);
  assert.match(output, /of \/\[\/\*\]\/\.exec\(s\) && \/\[(\*\/)\]\/\.exec\(s\)/);
  assert.match(output, /\{ return await \/\[\/\*\]\/\.test\(s\) && \/\[(\*\/)\]\/\.test\(s\); \}/);
  assert.match(output, /var x = `\$\{async \(\) => 1\}` && await \/ 2;/);

  const es5BuildSnippet = [
    '/**!',
    ' * @license MIT',
    ' *//**',
    ' * @description strip me',
    ' */',
    'for (var f = function () { s = "a"; { s = "b"; } /[/*]/.test(s) && /[*/]/.test(s); }; false; ) {}',
    'for (var g = function () { s = "a"; { s = "b"; } /[//]/.test(s);',
    'var z = 1; }; false; ) {}'
  ].join('\n');

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pgmmv-build-vectors-'));
  try {
    fs.writeFileSync(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({ name: '@kidthales/vectors-plugin', version: '0.2.0' }),
      'utf8'
    );
    fs.writeFileSync(path.join(tempRoot, 'plugin.js'), es5BuildSnippet, 'utf8');

    const outPath = await buildPlugin({ rootDir: tempRoot, cwd: tempRoot });
    const built = fs.readFileSync(outPath, 'utf8');
    assert.match(built, /@license MIT/);
    assert.doesNotMatch(built, /@description strip me/);
    assert.match(built, /\/\[\/\*\]\/\.test\(s\) && \/\[(\*\/)\]\/\.test\(s\)/);
    assert.match(built, /\/\[\/\/\]\/\.test\(s\);/);
    assert.match(built, /var z = 1;/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('eslint rejects non-ES5 syntax in plugin.js', () => {
  const result = spawnSync(process.execPath, [eslintBin, '--stdin', '--stdin-filename', 'plugin.js'], {
    cwd: ROOT,
    input: 'const x = () => 1;\n',
    encoding: 'utf8'
  });

  assert.notEqual(result.status, 0, 'ESLint must reject ES6+ syntax under ecmaVersion: 5');
  assert.match(result.stdout + result.stderr, /Parsing error/i);
});

test('tsc --noEmit rejects invalid @kidthales/pgmmv-types usage under checkJs', () => {
  const tempDir = fs.mkdtempSync(path.join(ROOT, '.tmp-tsc-probe-'));
  try {
    const probePath = path.join(tempDir, 'probe.js');
    fs.writeFileSync(
      probePath,
      [
        '/// <reference types="@kidthales/pgmmv-types/pgmmv.d.ts" />',
        '(function () {',
        '  /** @type {import("@kidthales/pgmmv-types").AgtkPlugin} */',
        '  var invalidPlugin = {',
        '    setLocale: function () {},',
        '    getInfo: function () {},',
        '    initialize: function () {',
        '      Agtk.nonexistent();',
        '    },',
        '    finalize: function () {},',
        '    setParamValue: function () {},',
        '    setInternal: function () {},',
        '    call: function () {},',
        '    execActionCommand: function () {',
        "      return 'not-a-number';",
        '    }',
        '  };',
        '  return invalidPlugin;',
        '})();'
      ].join('\n'),
      'utf8'
    );

    const tsconfigPath = path.join(tempDir, 'tsconfig.json');
    fs.writeFileSync(
      tsconfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: 'es2020',
            lib: ['es2020', 'dom'],
            module: 'nodenext',
            moduleResolution: 'nodenext',
            allowJs: true,
            checkJs: true,
            noEmit: true,
            strict: true,
            types: ['@kidthales/pgmmv-types']
          },
          include: ['probe.js']
        },
        null,
        2
      ),
      'utf8'
    );

    const result = spawnSync(process.execPath, [tscBin, '-p', tsconfigPath, '--noEmit'], {
      cwd: ROOT,
      encoding: 'utf8'
    });

    assert.notEqual(result.status, 0, 'tsc --noEmit must reject invalid Agtk API and return types');
    const output = result.stdout + result.stderr;
    assert.match(output, /TS2339/);
    assert.match(output, /TS2322/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
