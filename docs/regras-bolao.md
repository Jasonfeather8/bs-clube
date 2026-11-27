# Regras do bolão (domínio)

Documento de referência das regras de negócio do bolão. Descreve **o modelo alvo** definido com o cliente.
Leia antes de alterar qualquer coisa relacionada a bolão, rodada, ranking, apuração, prêmio ou datas.

> **Status da implementação:** as regras abaixo são o **alvo**. Até a Etapa 1 (banco) ser concluída, o sistema
> ainda opera no modelo antigo: **um único concurso por bolão** e pagamento para quem acerta **4 ou mais** dezenas.
> Não presuma que o código já implementa este documento.

## Conceitos

- **Bolão (pool):** sala com um número fixo de cotas. Um bolão cobre **vários concursos** até atingir o objetivo.
- **Rodada:** um concurso publicado dentro do bolão. Um bolão tem no máximo **20 rodadas**.
- **Cota:** uma aposta com 6 dezenas. O valor da cota é **único** e cobre todas as rodadas do bolão.
- **Meta:** ter **as 6 dezenas da cota sorteadas ao menos uma vez**, somando todas as rodadas.
- **Apuração:** pagamento do prêmio e encerramento do bolão. Acontece **uma única vez** por bolão.

## Regra de acerto

- O acerto é **acumulado por rodada**, contando **dezenas distintas**.
- Uma dezena sorteada em mais de uma rodada conta **apenas uma vez**.
- Portanto o progresso de uma cota vai de `0/6` a `6/6`, e a meta é atingir `6/6`.
- Exemplo: a cota `10 14 27 28 37 57` fecha a meta quando essas 6 dezenas tiverem saído, em qualquer
  combinação de rodadas.

## Encerramento

- O bolão **só encerra quando ao menos uma cota atinge a meta** (6/6).
- **Só a meta paga.** Quem acerta 5 não recebe nada. Não existe premiação por quadra, quina ou acerto parcial.
- Atingida a meta, o bolão é encerrado **naquela rodada** e apurado imediatamente.
- **Teto de 20 rodadas.** Se ninguém atingir a meta até a 20ª rodada, o bolão encerra assim mesmo e o prêmio
  é rateado entre as cotas com o **maior acúmulo**. Este é um caminho de exceção, considerado improvável.

## Rateio

- O valor do prêmio é o arrecadado menos o percentual da casa (`house_percentage` / `winner_percentage`).
- Se **duas** cotas atingirem a meta na mesma rodada, o prêmio é **dividido por 2**; se **três**, por 3; e assim
  por diante, em partes iguais. A sobra de arredondamento vai para a última cota paga, como já ocorre hoje.

## Venda de cotas

- Um bolão vende cotas enquanto estiver com status `open` ou `late_registration`.
- **Ninguém entra depois da primeira rodada.** Publicar a 1ª rodada fecha a venda (`status = 'closed'`).
- Não existe entrada tardia no meio das rodadas. Para novas entradas, cria-se **outro bolão** (outra sala).
- Um bolão pode iniciar as rodadas sem ter preenchido todas as vagas.

## Datas

São **quatro** datas distintas e nenhuma pode ser reaproveitada no lugar de outra:

| Data | Onde vive | Significado |
| --- | --- | --- |
| Criação do bolão | `pools.created_at` | Quando o bolão foi criado. |
| Data do sorteio | `draws.draw_date` (uma por rodada) | A data do concurso, **informada pelo admin ao publicar a rodada**. |
| Publicação da rodada | `pool_rounds.published_at` | Quando as dezenas daquela rodada foram publicadas no sistema. |
| Conclusão do bolão | `pools.settled_at` / `prize_settlements.created_at` | Quando o bolão foi apurado e encerrado. |

### Defeito conhecido no modelo antigo

Hoje existe apenas `draws.draw_date`, e ela é **sobrescrita** no momento da apuração
(`register_pool_result` faz `UPDATE draws SET draw_date = <data informada no formulário>`). Como o modal admin
exibe esse mesmo campo como "Data do sorteio" e também como "Resultado publicado", a data de conclusão acaba
aparecendo como se fosse a do sorteio. A data de criação (`pools.created_at`) não é exibida em lugar nenhum.
Isso deve ser corrigido com a separação das quatro datas acima.

## Ciclo de vida

1. **Criado** — `status = 'open'`, sem rodadas. Vende cotas.
2. **Vagas preenchidas** — `status = 'closed'` (trigger automático) quando `filled_slots` atinge `total_slots`.
   Continua aguardando a 1ª rodada.
3. **Em andamento** — a partir da publicação da 1ª rodada. Venda encerrada. Acumula rodadas (1 a 20).
4. **Concluído** — `status = 'completed'`, com apuração registrada em `prize_settlements`. Não aceita novas
   rodadas nem edição.
5. **Inativo** — `status = 'inactive'`, retirado da vitrine. Bolão já concluído não pode ser inativado.

## Operação administrativa

- **Publicar rodada:** informa concurso, **data do sorteio** e as 6 dezenas. A 1ª rodada fecha a venda. A
  publicação **não apura**, a menos que alguém atinja a meta naquela rodada.
- **Corrigir rodada:** as dezenas de uma rodada podem ser reeditadas **enquanto o bolão não estiver apurado**.
  Depois da apuração, nada é editável.
- Um concurso pode ser compartilhado entre bolões diferentes (o `draws` é global); o vínculo do bolão com cada
  rodada é o que define o histórico.

## Decisões já fechadas com o cliente

- Acerto **acumulado**, contando dezenas distintas (repetição entre rodadas não conta duas vezes).
- **Só 6 acertos** pagam; 5 não recebe nada.
- Empate na mesma rodada: **divisão igual**.
- Cota com **valor único**, cobrindo todas as rodadas.
- **Sem entrada** depois do primeiro sorteio.
- Teto de **20 rodadas**.
