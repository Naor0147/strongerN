import { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import { DIAGNOSES, DiagnosisId } from './diagnoses';

export default class AIReporter implements Reporter {
  private failures: Array<{
    testName: string;
    error: any;
  }> = [];
  private totalTests = 0;
  private passedTests = 0;

  onBegin(config: any, suite: any) {
    this.totalTests = suite.allTests().length;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === 'passed') {
      this.passedTests++;
    } else if (result.status === 'failed' || result.status === 'timedOut') {
      const rawError = result.errors[0] || result.error;
      let message = rawError?.message
        ? rawError.message.replace(/\u001b\[[0-9;]*m/g, '')
        : 'Unknown error';
      if (result.stdout.length > 0) {
        message += '\nSTDOUT:\n' + result.stdout.map(chunk => chunk.toString()).join('');
      }
      if (result.stderr.length > 0) {
        message += '\nSTDERR:\n' + result.stderr.map(chunk => chunk.toString()).join('');
      }
      this.failures.push({
        testName: test.title,
        error: { message },
      });
    }
  }

  onEnd(result: FullResult) {
    if (this.failures.length === 0) {
      console.log(`SUMMARY ${this.passedTests} passed 0 failed`);
      return;
    }

    for (const fail of this.failures) {
      console.log(`\nFAIL: ${fail.testName}`);
      console.log(`REASON: ${fail.error.message}`); // Only the first line of the error message to keep it extremely concise

      // Check if diagnostic ID is present in error message
      let diagId: DiagnosisId | null = null;
      const diagMatch = fail.error.message.match(/\[DiagnosticError\]\s+(\w+)/);
      if (diagMatch && diagMatch[1] in DIAGNOSES) {
        diagId = diagMatch[1] as DiagnosisId;
      } else {
        // Fallback search in the error string
        for (const key of Object.keys(DIAGNOSES)) {
          if (fail.error.message.includes(key)) {
            diagId = key as DiagnosisId;
            break;
          }
        }
      }

      if (diagId) {
        const diag = DIAGNOSES[diagId];
        console.log(`SOURCE: ${diag.source}`);
        console.log(`ANCHOR: ${diag.anchor}`);
        console.log(`FIX: ${diag.fix}`);
      } else {
        console.log(`SOURCE: Unknown`);
        console.log(`ANCHOR: N/A`);
        console.log(`FIX: N/A`);
      }
    }

    console.log(`\nSUMMARY ${this.passedTests} passed ${this.failures.length} failed`);
  }
}
