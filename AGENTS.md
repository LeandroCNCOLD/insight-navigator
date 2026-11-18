## Economia de contexto

- Comece pela tela, rota, símbolo ou arquivo da tarefa. Use `rg` e leia os trechos relevantes antes de ampliar a busca. Carregue o procedimento específico só quando for necessário.
- Para diffs, testes e logs extensos, use RTK quando instalado e compatível com o comando. Exemplos: `rtk git diff`, `rtk npm test` e `rtk pytest`. Use o comando original se o RTK estiver indisponível ou se o resumo omitir evidências necessárias.
- Reaproveite verificações do mesmo commit e ambiente quando a mudança não as invalidar. Registre commit, arquivos alterados, testes e pendências para retomar o trabalho com um resumo curto.
