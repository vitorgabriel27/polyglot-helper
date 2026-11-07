# Local English → Brazilian Portuguese translation

The worker loads the Argos OPUS-derived `translate-en_pb-1_9` package through CTranslate2, without installing the Argos application, Torch or Stanza. Tokenization uses SentencePiece. Only the model/tokenizer, metadata and original package README are extracted.

Model attribution: Jörg Tiedemann and Santhosh Thottingal, OPUS-MT (2020). The original model is CC BY 4.0 according to the package README, retained in the downloaded model directory. Package source and SHA-256 are pinned in model.json. Weights are downloaded during explicit setup and are not committed to this repository.

Sources:

- https://github.com/argosopentech/argospm-index/blob/main/index.json
- https://data.argosopentech.com/argospm/v1/
- https://github.com/argosopentech/argos-translate/blob/master/argostranslate/tokenizer.py
- https://opennmt.net/CTranslate2/translation.html

Runtime is local and text stays in memory. This baseline translates caption-sized English text, not arbitrary documents or every language. Translation quality requires a broader domain/speech benchmark before choosing a final production engine.
