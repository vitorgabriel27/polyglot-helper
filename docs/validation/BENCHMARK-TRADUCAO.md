# Baseline local de tradução — ensaio de desenvolvimento

Data: 07/11/2026. Avanço parcial de TR-04; STT-04 permanece pendente.

## Reprodução

Com ambiente e modelos já preparados (`pnpm setup:local`):

```sh
pnpm benchmark:translation
```

Não baixa conteúdo, captura áudio nem chama APIs. Executa o adaptador real e grava relatório JSON em `test-results/benchmark-translation/report-<timestamp>.json`, ignorado pelo Git. Cada execução preserva os relatórios anteriores. Falha do worker encerra o comando com código não zero, sem publicar relatório completo.

Dataset: `tests/fixtures/translation-en-pt-BR.json`, 30 exemplos originais com referências preliminares em pt-BR: dez cotidianos, dez expressões/phrasal verbs e dez contextuais. É um conjunto de desenvolvimento, ainda sem revisão bilíngue independente; não é teste congelado do MR. Não contém captura pessoal. Alterações mudam o hash registrado no relatório.

Protocolo: um carregamento, uma frase de aquecimento excluída e três repetições sequenciais por frase. Registra saída, tempo do worker e tempo de ida e volta do adaptador, CPU/SO/Node, hash do dataset e dos pesos. A latência inclui IPC e inferência; exclui ASR, segmentação e interface. O percentil empírico usa nearest rank das 90 observações correlacionadas; não representa p95 de uso real, outros equipamentos ou frases inéditas.

## Resultado inicial

Linux x64, Node 23.11.1, modelo `translate-en_pb-1_9`, CPU local. Relatório original: `test-results/benchmark-translation/report-1794070466249.json` (artefato local).

| Medida                    | Resultado |
| ------------------------- | --------- |
| Frases / observações      | 30 / 90   |
| Carregamento do worker    | 173,1 ms  |
| Mediana de ida e volta    | 21,4 ms   |
| p95 empírico deste ensaio | 27,9 ms   |
| Máximo observado          | 31,5 ms   |

Não há custo de API nesta execução. Energia, hardware, preparação dos modelos e custo operacional total não foram medidos.

## Qualidade: divergências observadas

Inspeção inicial assistida, sem nota agregada ou aceite bilíngue:

- `tr-10`: “There are only three tickets left.” → “Só faltam três ingressos.” Troca a ideia de ingressos restantes pela de ingressos faltando.
- `tr-11`: “It is raining cats and dogs.” → “Está chovendo gatos e cães.” Tradução literal perde o sentido de chuva intensa.
- `tr-14`: “You hit the nail on the head.” → “Você acertou o prego na cabeça.” Perde o sentido figurado de acertar em cheio.
- `tr-16`: “This phone costs an arm and a leg.” → “Este telefone custa um braço e uma perna.” Expressão literal pouco natural em pt-BR.

O baixo tempo de inferência não resolve essas falhas de sentido. São casos para futura comparação entre modelos e cascata; não autorizam envio remoto nem definem sozinhos uma regra de escalada.

## Pendências e revisão

O relatório deixa `meaning`, `fluency` e `notes` por frase para revisão humana. Avaliar preservação de sentido (0: incorreto, 1: parcial, 2: preservado) e fluência (0: difícil, 1: compreensível, 2: natural), documentando revisor e divergências; variantes válidas não precisam copiar a referência. Esses campos começam nulos e não contam como qualidade medida.

Próximos passos: revisar referências/saídas, ampliar amostras e repetições independentes, medir recursos e latência de ponta a ponta, executar no Windows e preparar áudio controlado com transcrição de referência para WER/STT-04. TR-04 permanece aberto até cumprir seu aceite completo.
