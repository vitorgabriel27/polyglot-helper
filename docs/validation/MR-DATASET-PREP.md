# MR-06 — preparação do dataset

Data: 07/11/2026. Esta entrega adiciona validação de metadados; não adiciona áudio, transcrição real nem rótulos de pesquisa.

## Validador

`scripts/research/validate_dataset.py` lê JSONL e valida schemaVersion, versão consistente, IDs únicos, tarefa/idioma, referência, rótulo, política, hash SHA-256, consentimento concedido com finalidade e prazo vigente, origem/licença e congelamento do split de teste. Também rejeita vazamento de `sessionGroupId`, `speakerGroupId` ou `paraphraseFamilyId` entre treino, validação e teste.

Diagnósticos incluem somente código, linha e ID opaco; o texto de referência não é copiado para stdout. O script usa apenas a biblioteca padrão Python.

No Linux:

```sh
python3 scripts/research/validate_dataset.py /caminho/fora-do-repositorio/authorized-manifest.jsonl
```

No Windows:

```powershell
py -3 scripts/research/validate_dataset.py C:\caminho\fora-do-repositorio\authorized-manifest.jsonl
```

## Testes e limites

`tests/research-dataset.test.ts` cria três registros de teste sintéticos em pasta temporária e a remove ao final. Verifica dataset estruturalmente válido, grupos cruzando splits, consentimento revogado e tipos malformados. Esses fixtures não são exemplos de treino nem autorizam coleta.

MR-06 continua pendente até existir um conjunto próprio com consentimento rastreável, referências revisadas, splits por sessão/locutor/paráfrase e hash/congelamento do teste. Sem esse conjunto, MR-09 não deve treinar nem reportar métricas.
