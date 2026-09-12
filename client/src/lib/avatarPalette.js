const GRADIENTS = [
  ['#ff885e', '#ff516a'],
  ['#ffcd6a', '#ff9d42'],
  ['#82b1ff', '#665fff'],
  ['#a0de7e', '#54cb68'],
  ['#53edd6', '#28c9b7'],
  ['#72d5fd', '#2a9ef1'],
  ['#e0a2f3', '#d669ed'],
  ['#ffa8a8', '#fa5252'],
];

export function gradientFor(seed) {
  const str = String(seed || '?');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  const [from, to] = GRADIENTS[hash % GRADIENTS.length];
  return `linear-gradient(160deg, ${from}, ${to})`;
}
