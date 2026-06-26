const NAME_GENERATOR_URL = "https://esm.run/unique-names-generator@4.7.1";

const fallbackAdjectives = [
  "Bouncy",
  "Cosmic",
  "Dizzy",
  "Glowing",
  "Jolly",
  "Sneaky",
  "Sparkly",
  "Zesty"
];
const fallbackNouns = [
  "Comet",
  "Lantern",
  "Meteor",
  "Moonbeam",
  "Nebula",
  "Photon",
  "Quasar",
  "Stardust"
];

let externalGenerator = null;
let externalGeneratorPromise = null;

export function generateFallbackName(seed = Date.now()) {
  const hash = hashSeed(seed);
  const adjective = fallbackAdjectives[hash % fallbackAdjectives.length];
  const noun = fallbackNouns[Math.floor(hash / fallbackAdjectives.length) % fallbackNouns.length];
  return `${adjective} ${noun}`;
}

export async function loadNameGenerator() {
  if (externalGenerator) {
    return externalGenerator;
  }

  externalGeneratorPromise ??= import(NAME_GENERATOR_URL)
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
