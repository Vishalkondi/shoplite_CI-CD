// Jenkins pipeline for ShopLite: test -> build images -> deploy on this machine.
//
// Requirements (see README section "Jenkins pipeline"):
//   - A Linux Jenkins agent with the Docker CLI and access to a Docker engine
//     (e.g. Jenkins running in Docker Desktop with the Docker socket mounted).
//   - Plugins: Pipeline, Git, Docker Pipeline, Credentials Binding.
//   - A "Secret text" credential with ID shoplite-db-password: the database
//     password for the Jenkins deployment. It must stay the same between
//     builds, because PostgreSQL only reads it when the volume is first created.
//
// The deployment is a separate Compose project ("shoplite-jenkins") on its own
// ports, so it never clashes with the stack you start yourself with
// `docker compose up` (ports 3000/5000/5433 by default).
pipeline {
  agent any

  options {
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds() // two deploys at once would fight over the same containers
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  environment {
    COMPOSE_PROJECT_NAME = 'shoplite-jenkins'
    // Shell variables override .env, so these win over the template's ports.
    FRONTEND_PORT = '8081'
    BACKEND_PORT  = '5001'
    DB_HOST_PORT  = '5434'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    // npm runs in a throwaway node:22 container, so the Jenkins agent itself
    // doesn't need Node.js. reuseNode keeps the same workspace.
    stage('Backend Tests') {
      agent {
        docker { image 'node:22-alpine'; reuseNode true }
      }
      steps {
        dir('backend') {
          sh 'npm ci'
          // Unit + API tests. The PostgreSQL integration tests skip here
          // (no TEST_DATABASE_URL); they run in GitHub Actions, and the
          // Deploy stage below checks the real database end to end.
          sh 'npm test'
        }
      }
    }

    stage('Frontend Tests & Build') {
      agent {
        docker { image 'node:22-alpine'; reuseNode true }
      }
      steps {
        dir('frontend') {
          sh 'npm ci'
          sh 'npm run test:coverage'
          sh 'npm run build'
        }
      }
      post {
        success {
          archiveArtifacts artifacts: 'frontend/dist/**', fingerprint: true
        }
      }
    }

    stage('Docker Build') {
      steps {
        withCredentials([string(credentialsId: 'shoplite-db-password', variable: 'DB_PASSWORD')]) {
          // .env is never committed: build it from the template. umask keeps
          // the file readable only by the Jenkins user.
          sh '''
            umask 077
            sed "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$DB_PASSWORD/" .env.example > .env
          '''
        }
        sh 'docker compose config --quiet'
        sh 'docker compose build'
      }
    }

    stage('Deploy Locally') {
      steps {
        sh 'docker compose up --detach --wait --wait-timeout 180 --remove-orphans'
        // Smoke test from inside the containers: when Jenkins itself runs in
        // Docker, "localhost" would be the Jenkins container, not your PC.
        sh '''
          echo "--- API readiness (backend -> PostgreSQL)"
          docker compose exec -T backend node -e "fetch('http://localhost:5000/api/health/ready').then(r => { console.log(r.status); process.exit(r.ok ? 0 : 1) })"
          echo "--- Products through the nginx /api proxy"
          docker compose exec -T frontend wget -q -O - http://127.0.0.1/api/products/1
          echo
          echo "--- Homepage"
          docker compose exec -T frontend wget -q -O - http://127.0.0.1/ | grep -q '<div id="root">'
          echo "Deployed: store on http://localhost:${FRONTEND_PORT}, API on http://localhost:${BACKEND_PORT}"
        '''
      }
    }
  }

  post {
    failure {
      sh 'docker compose ps --all || true'
      sh 'docker compose logs --no-color --tail=200 || true'
    }
    // cleanup runs last (after failure), so the log commands above still have .env.
    cleanup {
      sh 'rm -f .env' // the password only needs to exist while Compose runs
    }
  }
}
