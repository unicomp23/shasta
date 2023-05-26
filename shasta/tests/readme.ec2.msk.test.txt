[airtime@shasta-worker-i-05be1688ec334f594-us-east-1 round.trip]$ export KAFKA_BROKERS=b-1.shastaprovisionedmskc.utshcb.c21.kafka.us-east-1.amazonaws.com:9098,b-2.shastaprovisionedmskc.utshcb.c21.kafka.us-east-1.amazonaws.com:9098,b-3.shastaprovisionedmskc.utshcb.c21.kafka.us-east-1.amazonaws.com:9098
[airtime@shasta-worker-i-05be1688ec334f594-us-east-1 round.trip]$ pwd
/home/airtime/tmp/john.davis/repo/shasta/shasta/tests/integ/deep.tests/round.trip
[airtime@shasta-worker-i-05be1688ec334f594-us-east-1 round.trip]$ npm test -- primitives_round_trip.test.ts

> shasta@1.0.0 test
> jest primitives_round_trip.test.ts

  console.log
    createKafka: env.KAFKA_BROKERS:  b-1.shastaprovisionedmskc.utshcb.c21.kafka.us-east-1.amazonaws.com:9098,b-2.shastaprovisionedmskc.utshcb.c21.kafka.us-east-1.amazonaws.com:9098,b-3.shastaprovisionedmskc.utshcb.c21.kafka.us-east-1.amazonaws.com:9098

      at createKafka (tests/integ/common/createKafka.ts:7:13)

  console.log
    All topics have been created

      at createTopics (tests/integ/config.ts:104:17)

  console.log
    Cleaned up admin client

      at createTopics (tests/integ/config.ts:110:21)

  console.log
    createKafka: env.KAFKA_BROKERS:  b-1.shastaprovisionedmskc.utshcb.c21.kafka.us-east-1.amazonaws.com:9098,b-2.shastaprovisionedmskc.utshcb.c21.kafka.us-east-1.amazonaws.com:9098,b-3.shastaprovisionedmskc.utshcb.c21.kafka.us-east-1.amazonaws.com:9098

      at createKafka (tests/integ/common/createKafka.ts:7:13)

  console.log
    createKafka: env.KAFKA_BROKERS:  b-1.shastaprovisionedmskc.utshcb.c21.kafka.us-east-1.amazonaws.com:9098,b-2.shastaprovisionedmskc.utshcb.c21.kafka.us-east-1.amazonaws.com:9098,b-3.shastaprovisionedmskc.utshcb.c21.kafka.us-east-1.amazonaws.com:9098

      at createKafka (tests/integ/common/createKafka.ts:7:13)

  console.log
    createKafka: env.KAFKA_BROKERS:  b-1.shastaprovisionedmskc.utshcb.c21.kafka.us-east-1.amazonaws.com:9098,b-2.shastaprovisionedmskc.utshcb.c21.kafka.us-east-1.amazonaws.com:9098,b-3.shastaprovisionedmskc.utshcb.c21.kafka.us-east-1.amazonaws.com:9098

      at createKafka (tests/integ/common/createKafka.ts:7:13)

  console.log
    publisher.send {
      "sendTo": {
        "kafkaKey": {
          "kafkaPartitionKey": {
            "sequenceNumberPath": {
              "hops": [
                {
                  "tag": "PATH_TYPE",
                  "integer": 5
                },
                {
                  "tag": "APP_ID",
                  "integer": 123
                }
              ]
            }
          }
        }
      },
      "replyTo": {
        "kafkaKey": {
          "kafkaPartitionKey": {
            "partitionInteger": 0
          }
        }
      },
      "payloads": [
        {
          "text": "some text"
        }
      ]
    }

      at Object.<anonymous> (tests/integ/deep.tests/round.trip/primitives_round_trip.test.ts:97:21)

 PASS  tests/integ/deep.tests/round.trip/primitives_round_trip.test.ts (18.741 s)
  pubsub
    ✓ primitive round trip (15817 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        18.788 s
Ran all test suites matching /primitives_round_trip.test.ts/i.
[airtime@shasta-worker-i-05be1688ec334f594-us-east-1 round.trip]$
