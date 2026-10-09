/**
 * Limite de 5 tentativas de login erradas por minuto, contadas por IP e por usuário
 * (PRD 10, Força bruta). Fica em memória: basta para uma instância só.
 */
export class LimiteLogin {
  private readonly falhas = new Map<string, number[]>();

  constructor(
    private readonly maximo = 5,
    private readonly janelaMs = 60_000,
  ) {}

  private chaves(ip: string, login: string) {
    return [`ip:${ip}`, `login:${login.toLowerCase()}`];
  }

  private recentes(chave: string, agora: number): number[] {
    const lista = (this.falhas.get(chave) ?? []).filter((t) => agora - t < this.janelaMs);
    if (lista.length) this.falhas.set(chave, lista);
    else this.falhas.delete(chave);
    return lista;
  }

  bloqueado(ip: string, login: string, agora = Date.now()): boolean {
    return this.chaves(ip, login).some((c) => this.recentes(c, agora).length >= this.maximo);
  }

  registrarFalha(ip: string, login: string, agora = Date.now()) {
    for (const chave of this.chaves(ip, login)) {
      this.falhas.set(chave, [...this.recentes(chave, agora), agora]);
    }
  }

  limpar() {
    this.falhas.clear();
  }
}
