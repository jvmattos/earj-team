# Integração do EARJ Team Space no site principal

O Team Space é uma aplicação separada, hospedada no Vercel, com login próprio (Supabase Auth). Ele **não precisa ser movido para o Firebase** — basta adicionar dois itens de menu no site existente que apontem para ele.

## URLs para o menu

Adicione dois itens de menu, cada um abrindo em uma nova aba:

| Item de menu        | URL                                                  |
|----------------------|-------------------------------------------------------|
| Team Space — Barra   | `https://earj-team.vercel.app/?campus=barra`          |
| Team Space — Gávea   | `https://earj-team.vercel.app/?campus=gavea`          |

O parâmetro `?campus=` pré-seleciona automaticamente o campus certo para usuários que têm acesso aos dois (admins). Usuários com acesso a apenas um campus sempre veem o seu próprio campus, independente do parâmetro.

Exemplo de HTML simples para o menu:

```html
<a href="https://earj-team.vercel.app/?campus=barra" target="_blank" rel="noopener noreferrer">
  Team Space — Barra
</a>
<a href="https://earj-team.vercel.app/?campus=gavea" target="_blank" rel="noopener noreferrer">
  Team Space — Gávea
</a>
```

## Login

O Team Space tem autenticação própria (Supabase). Cada pessoa que for usá-lo precisa ter uma conta criada previamente por um admin (pelo botão "Novo usuário" dentro do próprio Team Space). Não há integração de login único (SSO) com o site principal — ao abrir o link, o usuário verá a tela de login do Team Space e entrará com email/senha cadastrados ali.

## Alternativa: incorporar via iframe (não recomendado)

Tecnicamente é possível embutir a página em um `<iframe>` dentro do site principal em vez de abrir em nova aba:

```html
<iframe src="https://earj-team.vercel.app/?campus=barra" style="width:100%; height:100vh; border:0;"></iframe>
```

Isso funciona (não há bloqueio de `X-Frame-Options` configurado), mas não é recomendado: o Team Space tem seu próprio menu lateral, cabeçalho e fluxo de login que ficam estranhos dentro de um iframe pequeno, e funcionalidades como abrir o Google Calendar ou trocar de aba ficam confusas em uma janela embutida. O ideal é o link simples abrindo em nova aba.

## Domínio próprio (opcional, futuro)

Se no futuro quiserem que aparente ser parte do mesmo site (ex: `times.earj.com.br` em vez de `earj-team.vercel.app`), é possível apontar um subdomínio para o Vercel via DNS (registro CNAME), sem precisar mudar nada no código. Isso é configurado em quem administra o DNS do domínio `earj.com.br`, não no Firebase.
