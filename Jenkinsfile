node {
	stage('fetch') {
  git branch: 'docker-testing', url: 'https://github.com/victorbjelkholm/js-ipfs/'
	}
	stage('build') {
		sh "docker build -t ipfs/js-ipfs-test ."
	}
	stage('test') {
		sh "docker run --privileged -it ipfs/js-ipfs-test npm test"
	}
}
