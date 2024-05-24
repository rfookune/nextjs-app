/* eslint-disable @typescript-eslint/no-unused-vars */

import { Handler } from 'aws-lambda';
import { execFile } from 'child_process';
import path from 'path';

// Source: https://github.com/aws-samples/prisma-lambda-cdk

export const handler: Handler = async (event, context) => {
  // Currently we don't have any direct method to invoke prisma migration programmatically.
  // As a workaround, we spawn migration script as a child process and wait for its completion.
  // Please also refer to the following GitHub issue: https://github.com/prisma/prisma/issues/4703
  try {
    const exitCode = await new Promise((resolve, _) => {
      execFile(
        path.resolve('./node_modules/prisma/build/index.js'),
        ['migrate', 'deploy'],
        (error, stdout, stderr) => {
          console.log(stdout);
          if (error != null) {
            console.log(
              `prisma 'migrate deploy' exited with error ${error.message}`,
            );
            if (error.stack) {
              console.error(error.stack);
            }

            if (stderr) {
              console.error(stderr);
            }

            resolve(error.code ?? 1);
          } else {
            resolve(0);
          }
        },
      );
    });

    if (exitCode != 0) {
      throw Error(
        `Prisma migration deployment failed with exit code ${exitCode}`,
      );
    }
  } catch (e) {
    console.log(e);
    throw e;
  }
};
