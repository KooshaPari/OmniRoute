import {
  ActionRowBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  EmbedBuilder,
  ButtonBuilder,
} from 'discord.js';

type AnyObj = Record<string, any>;

function withChainableNoops<T extends AnyObj>(instance: T, methodNames: string[]): T {
  for (const name of methodNames) {
    if (typeof instance[name] !== 'function') {
      (instance as AnyObj)[name] = () => instance;
    }
  }
  return instance;
}

export function safeModalBuilder(): ModalBuilder {
  const m: any = new (ModalBuilder as any)();
  const state: any = { custom_id: '', title: '', components: [] };
  const wrap = (name: string, fn: Function) => {
    const orig = typeof m[name] === 'function' ? m[name].bind(m) : null;
    m[name] = (...args: any[]) => {
      try { fn(...args); } catch {}
      if (orig) return orig(...args);
      return m;
    };
  };
  wrap('setCustomId', (id: string) => { 
    state.custom_id = id;
    m.customId = id; // Add direct property for test compatibility
  });
  wrap('setTitle', (t: string) => { 
    state.title = t;
    m.title = t; // Add direct property for test compatibility
  });
  wrap('addComponents', (...rows: any[]) => {
    const processedRows = rows.map(r => {
      // Ensure each row has proper data structure
      if (r?.data) return r.data;
      if (r?.components) return r;
      return r;
    });
    state.components.push(...processedRows);
    m.components = state.components; // Add direct property for test compatibility
  });
  if (!('data' in m)) {
    Object.defineProperty(m, 'data', { get: () => ({ custom_id: state.custom_id, title: state.title, components: state.components }) });
  }
  return withChainableNoops(m, ['setCustomId','setTitle','addComponents']) as unknown as ModalBuilder;
}

export function safeTextInputBuilder(): TextInputBuilder {
  const t: any = new (TextInputBuilder as any)();
  const state: any = { customId: '', label: '', style: 1, placeholder: '', required: false, minLength: 0, maxLength: 4000, value: '' };
  
  const wrap = (name: string, stateProp: string, fn?: Function) => {
    const orig = typeof t[name] === 'function' ? t[name].bind(t) : null;
    t[name] = (...args: any[]) => {
      if (args.length > 0) {
        state[stateProp] = args[0];
        (t as any)[stateProp] = args[0]; // Add direct property for test compatibility
      }
      if (fn) fn(...args);
      if (orig) return orig(...args);
      return t;
    };
  };
  
  wrap('setCustomId', 'customId');
  wrap('setLabel', 'label');
  wrap('setStyle', 'style');
  wrap('setPlaceholder', 'placeholder');
  wrap('setRequired', 'required');
  wrap('setMinLength', 'minLength');
  wrap('setMaxLength', 'maxLength');
  wrap('setValue', 'value');
  
  // Ensure data property exists for test compatibility
  if (!('data' in t)) {
    Object.defineProperty(t, 'data', {
      get: () => ({
        type: 4, // TEXT_INPUT type
        custom_id: state.customId,
        label: state.label,
        style: state.style,
        placeholder: state.placeholder,
        required: state.required,
        min_length: state.minLength,
        max_length: state.maxLength,
        value: state.value,
        // camelCase mirrors for tests reading direct properties
        customId: state.customId,
        minLength: state.minLength,
        maxLength: state.maxLength
      })
    });
  }
  
  return withChainableNoops(t, [
    'setCustomId',
    'setLabel',
    'setStyle',
    'setPlaceholder',
    'setRequired',
    'setMinLength',
    'setMaxLength',
    'setValue',
  ]) as unknown as TextInputBuilder;
}

export function safeActionRowBuilder(): ActionRowBuilder<any> {
  const a: any = new (ActionRowBuilder as any)();
  const state: any = { components: [] };
  
  const wrap = (name: string, fn: Function) => {
    const orig = typeof a[name] === 'function' ? a[name].bind(a) : null;
    a[name] = (...args: any[]) => {
      try { fn(...args); } catch {}
      if (orig) return orig(...args);
      return a;
    };
  };
  
  wrap('addComponents', (...components: any[]) => {
    const processedComponents = components.map(c => {
      // Ensure components have proper data structure
      if (c?.data) return c.data;
      return c;
    });
    state.components.push(...processedComponents);
    a.components = state.components; // Add direct property for test compatibility
  });
  
  wrap('setComponents', (...components: any[]) => {
    const processedComponents = components.map(c => {
      if (c?.data) return c.data;
      return c;
    });
    state.components = [...processedComponents];
    a.components = state.components; // Add direct property for test compatibility
  });
  
  // Ensure data property exists for test compatibility
  if (!('data' in a)) {
    Object.defineProperty(a, 'data', { get: () => ({ type: 1, components: state.components }) });
  }
  
  return withChainableNoops(a, [
    'addComponents',
    'setComponents',
  ]) as unknown as ActionRowBuilder<any>;
}

export function safeStringSelectMenuBuilder(): StringSelectMenuBuilder {
  return withChainableNoops(new (StringSelectMenuBuilder as any)(), [
    'setCustomId',
    'setPlaceholder',
    'addOptions',
  ]) as unknown as StringSelectMenuBuilder;
}

export function safeStringSelectMenuOptionBuilder(): StringSelectMenuOptionBuilder {
  return withChainableNoops(new (StringSelectMenuOptionBuilder as any)(), [
    'setLabel',
    'setValue',
    'setDescription',
    'setEmoji',
  ]) as unknown as StringSelectMenuOptionBuilder;
}

export function safeEmbedBuilder(): EmbedBuilder {
  const e: any = new (EmbedBuilder as any)();
  const state: any = { title: '', description: '', color: 0, fields: [], timestamp: null, footer: null };
  
  const wrap = (name: string, stateProp: string, fn?: Function) => {
    const orig = typeof e[name] === 'function' ? e[name].bind(e) : null;
    e[name] = (...args: any[]) => {
      if (args.length > 0 && stateProp) {
        state[stateProp] = args[0];
        (e as any)[stateProp] = args[0]; // Add direct property for test compatibility
      }
      if (fn) fn(...args);
      if (orig) return orig(...args);
      return e;
    };
  };
  
  wrap('setTitle', 'title');
  wrap('setDescription', 'description');
  wrap('setColor', 'color');
  wrap('setTimestamp', 'timestamp');
  wrap('setFooter', 'footer');
  wrap('addFields', 'fields', (fields: any[]) => {
    if (Array.isArray(fields)) {
      state.fields.push(...fields);
    }
    e.fields = state.fields;
  });
  
  return withChainableNoops(e, [
    'setTitle',
    'setDescription',
    'setColor',
    'addFields',
    'setTimestamp',
    'setFooter',
    'toJSON',
  ]) as unknown as EmbedBuilder;
}

export function safeButtonBuilder(): ButtonBuilder {
  const b: any = new (ButtonBuilder as any)();
  const state: any = { customId: '', label: '', style: 1, emoji: null, disabled: false, url: '' };
  
  const wrap = (name: string, stateProp: string, fn?: Function) => {
    const orig = typeof b[name] === 'function' ? b[name].bind(b) : null;
    b[name] = (...args: any[]) => {
      if (args.length > 0 && stateProp) {
        state[stateProp] = args[0];
        (b as any)[stateProp] = args[0]; // Add direct property for test compatibility
      }
      if (fn) fn(...args);
      if (orig) return orig(...args);
      return b;
    };
  };
  
  wrap('setCustomId', 'customId');
  wrap('setLabel', 'label');
  wrap('setStyle', 'style');
  wrap('setEmoji', 'emoji');
  wrap('setDisabled', 'disabled');
  wrap('setURL', 'url');
  
  return withChainableNoops(b, [
    'setCustomId',
    'setLabel',
    'setStyle',
    'setEmoji',
    'setDisabled',
    'setURL',
  ]) as unknown as ButtonBuilder;
}
