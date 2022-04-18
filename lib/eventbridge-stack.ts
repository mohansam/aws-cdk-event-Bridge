import { cfnTagToCloudFormation, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import *as lambda  from 'aws-cdk-lib/aws-lambda';
import *as events from'aws-cdk-lib/aws-events'
import * as eventsTarget from 'aws-cdk-lib/aws-events-targets';
import *as lambdaDestination from 'aws-cdk-lib/aws-lambda-destinations';
import * as cdk from 'aws-cdk-lib';
import *as logGroup from 'aws-cdk-lib/aws-logs';


export class EventbridgeStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

  const testBus=new events.EventBus(this,'testBus',{
    eventBusName:'testBus'
  });
  new cdk.CfnOutput(this,'testBusOutput',{
    value:testBus.eventBusArn,
    exportName:'testBusArn',
    description:'testBus arn to refer across multiple stacks'
  });
  
  testBus.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
  
  const eventBridgeInvokeFun=  new lambda.Function(this,'eventBridgeInvokeFun',{
   handler:'eventBridgeInvokeLambda.handler',
  runtime:lambda.Runtime.NODEJS_14_X,
  code:lambda.Code.fromAsset('./lambdaFn/eventBridgeInvoke'),
  architecture:lambda.Architecture.X86_64,
  description:'this is to test eventBridge',
  onSuccess:new lambdaDestination.EventBridgeDestination(testBus)    
  });
  
  const lambdaInvokeRule=new events.Rule(this,'lambdaInvokeRule',{
    eventBus:testBus,
    ruleName:'lambdaInvokeRule',  
    eventPattern:{"source":["lambdaInvokeRule"]}
  });
  lambdaInvokeRule.addTarget(new eventsTarget.LambdaFunction(eventBridgeInvokeFun));

 //this function will be invoked by eventBridgeInvokeFun
  const lambdaFunOne=new lambda.Function(this,'lambdaFunOne',{
    handler:'lambdaFunOne.handler',
   runtime:lambda.Runtime.NODEJS_14_X,
   code:lambda.Code.fromAsset('./lambdaFn/lambdaFunOne'),
   architecture:lambda.Architecture.X86_64,
   description:'this function will be invoked by rule lambdaFunOneRule',
   onSuccess:new lambdaDestination.EventBridgeDestination(testBus),
   onFailure:new lambdaDestination.EventBridgeDestination(testBus),
   });
   const lambdaFunOneRule=new events.Rule(this,'lambdaFunOneRule',{
    eventBus:testBus,
    ruleName:'lambdaFunOneRule',
    eventPattern:{
      "detail": {
        "requestContext": {
          "condition": ["Success"]
        },
        "responsePayload": {
          "source": ["eventBridgeTestBus"],
          "action": ["callLambdaFunOne"]
        }
      }}
  });
  lambdaFunOneRule.addTarget(new eventsTarget.LambdaFunction(lambdaFunOne));

//this function will be invoked by lambda function one
const lambdaFunTwo=new lambda.Function(this,'lambdaFunTwo',{
  handler:'lambdaFunTwo.handler',
 runtime:lambda.Runtime.NODEJS_14_X,
 code:lambda.Code.fromAsset('./lambdaFn/lambdaFunTwo'),
 architecture:lambda.Architecture.X86_64,
 description:'this function will be invoked by rule lambdaFunOneRule',
 onSuccess:new lambdaDestination.EventBridgeDestination(testBus),
 onFailure:new lambdaDestination.EventBridgeDestination(testBus),   
 });
 const lambdaFunTwoRule=new events.Rule(this,'lambdaFunTwoRule',{
  eventBus:testBus,
  ruleName:'lambdaFunTwoRule',
  eventPattern:{
    "detail": {
      "requestContext": {
        "condition": ["Success"]
      },
      "responsePayload": {
        "source": ["eventBridgeTestBus"],
        "action": ["callLambdaFunTwo"]
      }
    }}
});
lambdaFunTwoRule.addTarget(new eventsTarget.LambdaFunction(lambdaFunTwo));


  
  //centralized log rule
  const testBusSuccessLogRule=new events.Rule(this,'testBusSuccessLogRule',{
    eventBus:testBus,
    ruleName:'testBusSuccessLogRule',
    eventPattern:{
      "detail": {
        "requestContext": {
          "condition": ["Success"]
        },
        "responsePayload": {
          "source": ["eventBridgeTestBus"]
        }
      }}
  });
  const cwLogGroup=new logGroup.LogGroup(this,'testBusSuccessLogRuleGroup',{
    logGroupName:'testBusSuccessLogRule',
    removalPolicy:cdk.RemovalPolicy.DESTROY
  });
  testBusSuccessLogRule.addTarget(new eventsTarget.CloudWatchLogGroup(cwLogGroup));

  //centralized error log 
  const errLogRule=new events.Rule(this,'errLogRule',{
    eventBus:testBus,
    ruleName:'errLogRule',
    eventPattern:  {
      "detail": {
        "responsePayload": {
          "errorType": ["Error"]
        }
      }
    }
  });
  const cwErrorLogGroup=new logGroup.LogGroup(this,'cwErrorLogGroup',{
    logGroupName:'cwErrorLogGroup',
    removalPolicy:cdk.RemovalPolicy.DESTROY
  });
  errLogRule.addTarget(new eventsTarget.CloudWatchLogGroup(cwErrorLogGroup));
}}
