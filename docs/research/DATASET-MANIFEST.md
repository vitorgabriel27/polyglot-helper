# Manifesto do dataset PolyglotHelper

Status: esquema de governança preparado; dataset, referências e splits ainda não criados. Nenhum conteúdo de usuário é coletado ou usado para treino por este projeto.

Cada item de pesquisa futuro deve ter um ID opaco e registrar, em arquivo de metadados separado do conteúdo:

- `sampleId`, `sessionGroupId`, `speakerGroupId` e `paraphraseFamilyId` para impedir vazamento entre splits;
- finalidade, consentimento verificável, escopo de uso, origem/licença, política de retenção e data de expiração;
- idioma/variante, tarefa, referência revisada, versão de anotação e anotador(es), preservando trilha de correções;
- estado da política no caso: fonte, destino permitido, modo offline, geração, catálogo e orçamento;
- recursos/hardware e condições relevantes para reprodução, sem identificadores pessoais desnecessários.

## Splits e congelamento

Separar por sessão, locutor e família de paráfrases em treino, validação e teste. Um mesmo grupo não pode cruzar splits. Ajuste de features e thresholds ocorre apenas em treino/validação. O conjunto de teste recebe versão/hash e fica congelado antes da avaliação final; acesso para reajuste invalida o congelamento e exige novo teste.

## Armazenamento e exclusão

Áudio e texto de pesquisa ficam fora de logs de produto, em diretório/repositório com acesso e retenção próprios. Não há importação automática de captura ao vivo. Sem consentimento rastreável, referência válida ou direito de uso, o item é excluído. O manifesto publicado não deve conter áudio, transcrição, credenciais ou dados pessoais.

## Validação do manifesto

Os metadados podem ser preparados como JSONL e verificados antes de qualquer treino por `scripts/research/validate_dataset.py`. Cada linha registra versão, ID da amostra, split, IDs de agrupamento, tarefa/idioma, referência, rótulo de rota, decisão permitida, política, consentimento com finalidade e expiração, procedência/licença e SHA-256 do conteúdo. Amostras do split de teste precisam estar explicitamente congeladas. O validador rejeita consentimento ausente/expirado, hash inválido, versão inconsistente e qualquer sessão, locutor ou família de paráfrases presente em mais de um split.

Os testes usam registros inteiramente sintéticos em diretório temporário e não criam dataset de pesquisa.
