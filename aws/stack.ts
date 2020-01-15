import { Stack, Construct, App, StackProps, CfnOutput, CfnParameter, Duration } from '@aws-cdk/core';
import { CfnCacheCluster } from '@aws-cdk/aws-elasticache'
import { Function, Code, Runtime } from '@aws-cdk/aws-lambda';
import { Bucket } from '@aws-cdk/aws-s3'
import { LambdaRestApi } from '@aws-cdk/aws-apigateway'
import { CloudFrontWebDistribution } from '@aws-cdk/aws-cloudfront'
import events = require('@aws-cdk/aws-events');
import targets = require('@aws-cdk/aws-events-targets');


class GuDocs extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)

    const stageParameter = new CfnParameter(this, 'stage', {
      type: 'String',
      description: 'Stage', allowedValues: ['CODE', 'PROD']
    })

    const redis = new CfnCacheCluster(this, 'redis', {
      cacheNodeType: 'cache.t2.micro',
      numCacheNodes: 1,
      engine: 'redis'
    })

    const lambdaParams = {
      code: Code.fromBucket(Bucket.fromBucketName(this, 'codebucket', 'something'), "??"),
      runtime: Runtime.NODEJS_10_X
    }
    const batch = new Function(this, 'batch', {
      ...lambdaParams,
      handler: "batch",
    })

    const batchTrigger = new events.Rule(this, 'Rule', {
      schedule: events.Schedule.expression('rate (15 minutes)')
    });

    batchTrigger.addTarget(new targets.LambdaFunction(batch))

    const web = new Function(this, 'batch', {
      ...lambdaParams,
      handler: "web",
    })

    const webApi = new LambdaRestApi(
      this,
      'apigateway',
      {
        handler: web,
      },
    )

    new CloudFrontWebDistribution(
      this,
      'backend-cloudfront-distribution',
      {
        comment: `Cloudfront distribution for gudocs ${stageParameter.valueAsString}`,
        defaultRootObject: '',
        originConfigs: [
          {
            originPath: '/prod', //This is hard coded and could be the deployment id
            behaviors: [
              {
                isDefaultBehavior: true,
                defaultTtl: Duration.seconds(10),
              },
            ],
            customOriginSource: {
              domainName: `${webApi.restApiId}.execute-api.eu-west-1.amazonaws.com`, //Yes, this (the region) really should not be hard coded.
            },
          },
        ],
      },
    )

  }

}

new GuDocs(new App(), 'gudocs', {
  env: {
    region: 'eu-west-1'
  }
})