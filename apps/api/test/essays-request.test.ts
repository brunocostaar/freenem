import { describe, expect, it } from 'vitest';
import { buildRequestParams } from '../src/modules/essays/corrector.js';
import { buildDeepSeekRequest } from '../src/modules/essays/deepseek.js';

const FORBIDDEN = ['minimum', 'maximum', 'minLength', 'maxLength', 'multipleOf'];

function walk(node: unknown, visit: (n: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  if (node && typeof node === 'object') {
    visit(node as Record<string, unknown>);
    Object.values(node).forEach((v) => walk(v, visit));
  }
}

describe('buildRequestParams', () => {
  const params = buildRequestParams({ theme: 'Tema', text: 'Texto' }, 'claude-sonnet-5-5');
  const loose = params as Record<string, unknown>;

  it('não usa thinking desabilitado, tool_choice nem amostragem', () => {
    expect((loose.thinking as { type?: string } | undefined)?.type).not.toBe('disabled');
    for (const k of ['tool_choice', 'tools', 'temperature', 'top_p', 'top_k']) {
      expect(loose).not.toHaveProperty(k);
    }
  });

  it('usa saída estruturada com effort baixo por padrão', () => {
    expect(params.output_config.format.type).toBe('json_schema');
    expect(params.output_config.effort).toBe('low');
    expect(params.max_tokens).toBe(4000);
  });

  it('schema é compatível com structured outputs', () => {
    const schema = params.output_config.format.schema;
    walk(schema, (n) => {
      for (const k of FORBIDDEN) expect(n).not.toHaveProperty(k);
      if (n.type === 'object') {
        expect(n.additionalProperties).toBe(false);
        expect(Object.keys(n.properties as object).sort()).toEqual(
          [...(n.required as string[])].sort(),
        );
      }
    });
  });
});

describe('buildDeepSeekRequest', () => {
  const req = buildDeepSeekRequest({ theme: 'Tema', text: 'Texto do aluno' }, 'deepseek-chat');

  it('pede JSON e mantém a redação fora do system prompt', () => {
    expect(req.response_format.type).toBe('json_object');
    expect(req.messages[0]!.role).toBe('system');
    expect(req.messages[0]!.content).not.toContain('Texto do aluno');
    expect(req.messages[0]!.content).toContain('JSON');
    expect(req.messages[1]!.content).toContain('<redacao>\nTexto do aluno\n</redacao>');
  });
});
