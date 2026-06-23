import { route } from '@aurelia/router';

@route({
  routes: [
    {
      path: ['', 'welcome'],
      component: import('./pages/welcome-page'),
      title: 'Welcome',
    },
    {
      path: 'brief',
      component: import('./pages/brief-page'),
      title: 'Listening Brief',
    },
    {
      path: 'about',
      component: import('./pages/about-page'),
      title: 'About',
    },
  ],
})
export class MyApp {
}
