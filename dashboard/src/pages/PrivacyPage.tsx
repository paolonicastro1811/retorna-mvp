import { Link } from 'react-router-dom'

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-[#2d2d3a]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <header className="border-b border-gray-200 py-5">
        <div className="max-w-[720px] mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="text-xl font-extrabold text-[#1a1a2e]">Retorna</Link>
          <Link to="/" className="text-sm text-[#6b7280] hover:text-[#2d2d3a]">Voltar ao inicio</Link>
        </div>
      </header>

      <main className="max-w-[720px] mx-auto px-6 py-12">
        <h1 className="text-2xl font-extrabold text-[#1a1a2e] mb-2">Politica de Privacidade</h1>
        <p className="text-sm text-[#6b7280] mb-8">Ultima atualizacao: 1 de abril de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-[#2d2d3a] leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">1. Introducao</h2>
            <p>
              A Retorna (&quot;nos&quot;, &quot;nosso&quot; ou &quot;Plataforma&quot;) e uma plataforma SaaS que ajuda restaurantes a
              reativar clientes inativos via WhatsApp. Esta Politica de Privacidade descreve como coletamos,
              usamos, armazenamos e protegemos os dados pessoais de nossos usuarios (proprietarios de restaurantes)
              e dos clientes finais dos restaurantes, em conformidade com a Lei Geral de Protecao de Dados (LGPD — Lei 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">2. Dados que coletamos</h2>

            <h3 className="text-base font-semibold mt-4 mb-1">2.1 Dados dos proprietarios de restaurantes</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nome e email (para login via magic link)</li>
              <li>Nome do restaurante</li>
              <li>Numero de telefone do WhatsApp Business</li>
              <li>Credenciais de integracao com a API do WhatsApp Business (Meta)</li>
            </ul>

            <h3 className="text-base font-semibold mt-4 mb-1">2.2 Dados dos clientes finais</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nome (quando fornecido)</li>
              <li>Numero de telefone</li>
              <li>Historico de visitas (datas e valores gastos)</li>
              <li>Status de ciclo de vida (ativo, em risco, inativo)</li>
              <li>Preferencia de opt-in/opt-out para comunicacoes</li>
            </ul>

            <h3 className="text-base font-semibold mt-4 mb-1">2.3 Dados de uso</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Logs de acesso ao painel</li>
              <li>Metricas de campanhas (mensagens enviadas, entregues, lidas)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">3. Como usamos os dados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Prestacao do servico:</strong> identificar clientes inativos, enviar campanhas de reativacao via WhatsApp e atribuir receita gerada.</li>
              <li><strong>Autenticacao:</strong> enviar magic links por email para login seguro.</li>
              <li><strong>Analise e relatorios:</strong> gerar KPIs e relatorios de desempenho para o restaurante.</li>
              <li><strong>Melhoria do servico:</strong> analisar padroes de uso agregados para aprimorar a plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">4. Base legal (LGPD)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Execucao de contrato</strong> (Art. 7, V): processamento necessario para fornecer o servico contratado.</li>
              <li><strong>Consentimento</strong> (Art. 7, I): clientes finais podem optar por nao receber mensagens (opt-out).</li>
              <li><strong>Interesse legitimo</strong> (Art. 7, IX): analise agregada para melhoria do servico.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">5. Compartilhamento de dados</h2>
            <p>Compartilhamos dados apenas com os seguintes terceiros, estritamente necessarios para o funcionamento do servico:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Meta (WhatsApp Business API):</strong> numeros de telefone e conteudo das mensagens para envio via WhatsApp.</li>
              <li><strong>Resend:</strong> enderecos de email para envio de magic links de autenticacao.</li>
              <li><strong>Neon (PostgreSQL):</strong> armazenamento de dados em banco de dados com criptografia em repouso.</li>
              <li><strong>Anthropic (Claude AI):</strong> texto anonimizado das mensagens recebidas para classificacao de intencao (nenhum dado pessoal identificavel e enviado).</li>
            </ul>
            <p className="mt-2">Nao vendemos, alugamos ou compartilhamos dados pessoais com terceiros para fins de marketing.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">6. Armazenamento e seguranca</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Dados armazenados em servidores com criptografia em transito (TLS) e em repouso.</li>
              <li>Autenticacao sem senha (magic link) para eliminar riscos de senhas fracas.</li>
              <li>Tokens JWT com expiracao de 30 dias.</li>
              <li>Acesso restrito a dados do restaurante via autenticacao e autorizacao por restaurantId.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">7. Retencao de dados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Dados de clientes:</strong> mantidos enquanto o restaurante tiver conta ativa na plataforma.</li>
              <li><strong>Logs de campanhas:</strong> mantidos por 12 meses apos o envio.</li>
              <li><strong>Magic link tokens:</strong> excluidos automaticamente apos uso ou expiracao (15 minutos).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">8. Direitos dos titulares (LGPD)</h2>
            <p>Voce tem os seguintes direitos garantidos pela LGPD:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Confirmacao e acesso:</strong> saber se tratamos seus dados e acessar uma copia.</li>
              <li><strong>Correcao:</strong> solicitar a correcao de dados incompletos ou desatualizados.</li>
              <li><strong>Anonimizacao ou eliminacao:</strong> solicitar a exclusao de dados desnecessarios.</li>
              <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado.</li>
              <li><strong>Revogacao do consentimento:</strong> retirar seu consentimento a qualquer momento.</li>
              <li><strong>Eliminacao completa:</strong> solicitar a exclusao total dos seus dados (funcao &quot;Excluir dados LGPD&quot; disponivel no painel).</li>
            </ul>
            <p className="mt-2">
              Os clientes finais dos restaurantes podem solicitar a exclusao de seus dados a qualquer momento.
              O restaurante pode exercer esse direito diretamente pelo painel, utilizando a funcao de exclusao LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">9. Opt-out de mensagens</h2>
            <p>
              Todas as mensagens enviadas via WhatsApp incluem instrucoes claras para o destinatario se descadastrar.
              Ao responder com &quot;PARAR&quot; ou &quot;SAIR&quot;, o cliente e automaticamente marcado como opt-out e nao recebera
              mais mensagens de campanha.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">10. Cookies</h2>
            <p>
              A plataforma utiliza apenas cookies essenciais para autenticacao (token JWT armazenado em localStorage).
              Nao utilizamos cookies de rastreamento, analytics ou publicidade de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">11. Alteracoes nesta politica</h2>
            <p>
              Podemos atualizar esta politica periodicamente. Alteracoes significativas serao comunicadas
              por email ou notificacao no painel. A data de &quot;ultima atualizacao&quot; no topo indica a versao vigente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">12. Contato</h2>
            <p>
              Para exercer seus direitos, tirar duvidas ou fazer reclamacoes sobre o tratamento de dados pessoais:
            </p>
            <ul className="list-none space-y-1 mt-2">
              <li><strong>Email:</strong> privacidade@retornabrasil.com</li>
              <li><strong>Plataforma:</strong> retornabrasil.com</li>
            </ul>
          </section>

        </div>
      </main>

      <footer className="text-center py-6 text-[0.8rem] text-[#6b7280] border-t border-gray-200">
        <div className="max-w-[720px] mx-auto px-6">
          Retorna &copy; 2026 &middot; Todos os direitos reservados
          <div className="mt-2 space-x-4">
            <Link to="/privacy" className="hover:underline">Privacidade</Link>
            <Link to="/termos" className="hover:underline">Termos de Uso</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
