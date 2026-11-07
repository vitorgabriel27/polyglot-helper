import type { Segment } from '../core/contracts';

const samples = [
  { text: 'Take your time.', translation: 'Vá com calma.', pronunciation: '/teɪk jər taɪm/' },
  { text: 'Small steps make a difference.', translation: 'Pequenos passos fazem a diferença.', pronunciation: '/smɔːl stɛps meɪk ə ˈdɪfərəns/' },
  { text: 'Keep learning every day.', translation: 'Continue aprendendo todos os dias.', pronunciation: '/kiːp ˈlɝːnɪŋ ˈɛvri deɪ/' },
];

export function startDemo(generation: number, emit: (segment: Segment) => void) {
  let step = 0;
  const tick = () => {
    const sample = samples[Math.floor(step / 2) % samples.length];
    const isFinal = step % 2 === 1;
    emit({ ...sample, text: isFinal ? sample.text : sample.text.split(' ').slice(0, 2).join(' '),
      translation: isFinal ? sample.translation : '', pronunciation: isFinal ? sample.pronunciation : '',
      generation, startMs: Math.floor(step / 2) * 3600, endMs: Math.floor(step / 2) * 3600 + (isFinal ? 3600 : 1800), sequence: Math.floor(step / 2), segmentId: `${generation}:${Math.floor(step / 2)}`, revision: isFinal ? 2 : 1, isFinal });
    step += 1;
  };
  tick();
  const timer = setInterval(tick, 1800);
  return () => clearInterval(timer);
}
