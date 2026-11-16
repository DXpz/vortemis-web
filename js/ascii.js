export const ASCII = {
  map: String.raw`      +-------------+               +-------------+
      | host .10    |               | host .11    |
      +-------------+               +-------------+
             |                             |
             +--------------+--------------+
                            |
                  +---------+---------+
                  | conn.log          |
                  +-------------------+
                            |
                            |
                +-----------+-----------+
                | normalizer            |
                | six features          |
                +-----------------------+
                            |
                            |
                +-----------+-----------+
                | autoencoder           |
                | 6 > 16 > 3            |
                +-----------------------+
                            |
                            |
                +-----------+-----------+
                | MITRE rules           |
                | five tactics          |
                +-----------------------+
                            |
                            |
                     +------+------+
                     | /v1         |
                     +-------------+`,

  pipeline: String.raw` conn.log --> normalize --> score --> map --> postgres --> /v1`,

  divider: String.raw`+--------[ ingest ]--------[ score ]--------[ map ]--------[ serve ]--------+
|                       passive network telemetry, no payloads                  |
+-------------------------------------------------------------------------------+`,

  // Repeating motif for horizontal dividers; repeat to fill the available width.
  rule: String.raw`~~~.~~~*~~~+~~~.~~~*~~~[~~+~~]~~~.~~~*~~~+`,

  stars: String.raw`     .         *                    +   * .
      +                                   *  *     +       .
     *     *.+           .    .     +           *+*      .
         +      ..                *     .          .+     .
  +  .        +             *  *           .     .
           *             .         .   +
     *                                                .
 .   +.                               ..  .  *   ...
                 .      .                .             .
                +                   *.  +           *`,
};
