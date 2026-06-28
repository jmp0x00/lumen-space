import { NAME_CONFIG } from "./config.js";

let externalGenerator = null;
let externalGeneratorPromise = null;

export function generateFallbackName(seed = Date.now()) {
  const hash = hashSeed(seed);
  const adjective = NAME_CONFIG.fallbackAdjectives[hash % NAME_CONFIG.fallbackAdjectives.length];
  const noun =
    NAME_CONFIG.fallbackNouns[
      Math.floor(hash / NAME_CONFIG.fallbackAdjectives.length) %
        NAME_CONFIG.fallbackNouns.length
    ];
  return `${adjective} ${noun}`;
}

export async function loadNameGenerator() {
  if (externalGenerator) {
    return externalGenerator;
  }

  externalGeneratorPromise ??= import(NAME_CONFIG.generatorUrl)
    .then((module) => {
      externalGenerator = (seed = Date.now()) =>
        module.uniqueNamesGenerator({
          dictionaries: [module.adjectives, module.animals],
          length: 2,
          separator: " ",
          seed,
          style: "capital"
        });
      return externalGenerator;
    })
    .catch(() => generateFallbackName);

  return externalGeneratorPromise;
}

export async function generateDisplayName(seed = Date.now()) {
  const generator = await loadNameGenerator();
  return generator(seed);
}

export function generateDisplayNameSync(seed = Date.now()) {
  return externalGenerator ? externalGenerator(seed) : generateFallbackName(seed);
}

function hashSeed(seed) {
  const source = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}
