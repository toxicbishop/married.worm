const jsonfile = require('jsonfile');
const moment = require('moment');
const simpleGit = require('simple-git');
// const random = require('random'); // We don't need this anymore

const FILE_PATH = './data.json';

// Helper function to get a random integer between min and max (inclusive)
const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const makeCommit = n => {
    if (n === 0) return simpleGit().push();

    // Replace random.int(0, 51) with native math
    const x = getRandomInt(0, 51); 
    
    // Replace random.int(0, 6) with native math
    const y = getRandomInt(0, 6);  

    const DATE = moment().subtract(1, 'y').add(1, 'd')
        .add(x, 'w').add(y, 'd').format();

    const data = {
        date: DATE
    }
    
    console.log(DATE);
    
    jsonfile.writeFile(FILE_PATH, data, () => {
        simpleGit().add([FILE_PATH]).commit(DATE, { '--date': DATE }, makeCommit.bind(this, --n));
    });
};

makeCommit(150);