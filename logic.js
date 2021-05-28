const defaultMapSize = 15
const learningRate = 0.8
const discountFactor = 0.8

const spaceCell = 0
const reward = 1000
const penalty = -1000
const cliff = -10000


class TableCell {
    constructor(row, column) {
        this.row = row
        this.column = column

    /** Actions the agent can do
     * 
     *  If you want to add new actions(like diagonal pass) you can add them here
     *  Also you have to update "qTableInit" funtion, "rTableGenerator" function
     *  and "findPosibleActions" function
     * 
     *  Or you can create an object named "direction" and make it easier
     */
        this.north = 0
        this.east = 0
        this.south = 0
        this.west = 0
    }
}

class Point {
    constructor(div, row, column) {
        this.div = div
        this.row = row
        this.column = column
    }
}

var defaultWallRate = 0.3
var defaultGoalEpisode = 10000
var waitTime = 0
var isTraining = false

var rowSize, columnSize
var divMatrix, walls, startPoint, goalPoint, currentPoint, rTable, qTable, shortestWayParts


fixMapSize()

window.onresize = fixMapSize

document.addEventListener('contextmenu', event => event.preventDefault())

var controlButton
var isControlButtonAppear = false
var isTrainButtonAvtive = true

generateMap()

function fixMapSize(){
    var mapDiv = document.getElementById('map')
    var style = getComputedStyle(mapDiv)
    mapDiv.style.width = style.height
}

function setColor(colorSelector){
    switch(colorSelector.id){
        case 'startPointColorSelector':
            document.documentElement.style.setProperty('--startColor', colorSelector.value)
            break
        case 'goalPointColorSelector':
            document.documentElement.style.setProperty('--goalColor', colorSelector.value)
            break
        case 'wallColorSelector':
            document.documentElement.style.setProperty('--wallColor', colorSelector.value)
            break 
    }
}

function setWaitTime(newWaitTime){
    let waitTimeLabel = document.getElementById('waitTimeLabel')
    waitTimeLabel.innerHTML = newWaitTime + ' second'
    waitTime = newWaitTime*1000
}

function showWarning(message){
    let warningDiv = document.getElementById('warning')
    warningDiv.style.display = 'block'
    warningDiv.innerText = message

    setTimeout(()=>warningDiv.style.display = 'none',3000)
}

function resetGlobalVars(){
    divMatrix = []
    walls = []
    rTable = []
    qTable = []
    shortestWayParts = []
    episodeViaCost = []
    episodeViaStep = []
    isTraining = false
    startPoint = new Point(null,null,null)
    goalPoint = new Point(null,null,null)
    currentPoint = new Point(null,null,null)
}

function generateMap(){
    if(isTraining)
        return
    rowSize =  document.querySelector("input#row").value != ''?document.querySelector("input#row").value:defaultMapSize
    columnSize =  document.querySelector("input#column").value != ''?document.querySelector("input#column").value:defaultMapSize

    if(rowSize > 100){
        rowSize = 100
    }
    if(rowSize < 3){
        rowSize = 3
    }
    if(columnSize > 100){
        columnSize = 100
    }
    if(columnSize < 3){
        columnSize = 3
    }

    var mapDiv = document.getElementById('map')
    mapDiv.innerHTML = ''
    
    resetGlobalVars()

    for(let i = 0; i < rowSize; i++){
        let newRow = document.createElement('div')
        newRow.classList.add('row')

        let matrixRow = []

        for(let j = 0; j < columnSize; j++){
            let cell = document.createElement('div')
            cell.classList.add('cell')

            newRow.append(cell)
            matrixRow.push(cell)
        }
        mapDiv.append(newRow)
        divMatrix.push(matrixRow)
    }

    addWallsRandomly(rowSize,columnSize)

    addMouseEvents()

    controlButton = document.getElementById('train')
    
    controlButton.onclick = () => {
        isTrainButtonAvtive?run():cancel()
    }
    isControlButtonAppear = true
}

function addMouseEvents(){
    isMouseDown = false

    document.onmousedown = (event) => {
        if(event.button == 0)
        isMouseDown = true
    }

    document.onmouseup = () => {
        isMouseDown = false
    }

    for(let i = 0; i < rowSize; i++){
        for(let j = 0; j < columnSize; j++){
            if(!walls.includes(divMatrix[i][j])){
                divMatrix[i][j].classList.add('selectableCell')
            }

            divMatrix[i][j].onmouseenter = () => {
                if(isMouseDown){
                    if(!divMatrix[i][j].classList.contains('wall') && divMatrix[i][j].id != 'startPoint' && divMatrix[i][j].id != 'goalPoint'){
                        addWall(divMatrix[i][j])
                    }else if(divMatrix[i][j].classList.contains('wall')){
                        removeWall(divMatrix[i][j])
                    }
                }
            }

            divMatrix[i][j].onmousedown = (event) => {
                if(walls.includes(divMatrix[i][j])){
                    removeWall(divMatrix[i][j])
                }else{
                    if(event.button == 0){
                        if(divMatrix[i][j].id != 'startPoint' && divMatrix[i][j].id != 'goalPoint'){
                            addWall(divMatrix[i][j])
                        }
                    }else if(event.button == 1){
                        setStartPoint(i,j)
                        if(qTable.length != 0){
                            console.log(
                                'Q values: ' + JSON.stringify(qTable[i][j])
                            )
                        }
                    }else if(event.button == 2){
                        setGoalPoint(i,j)
                    }
                }
            }
        }
    }
}

function addWall(div){
    if(isTraining){
        return
    }
    
    window.requestAnimationFrame(
        () => {
            div.classList.remove('selectableCell')
            div.classList.add('wall')
        }
    )
    
    div.innerHTML = ''
    walls.push(div)
    
    rTable = []
    qTable = []
    rTableGenerator()
    qTableInit()
}

function removeWall(div){
    if(isTraining)
        return
    div.classList.remove('wall')
    div.classList.add('selectableCell')
    walls.splice(walls.indexOf(div), 1)
    rTable = []
    qTable = []
    rTableGenerator()
    qTableInit()
}

async function addWallsRandomly(rowSize, columnSize){
    let rateInput = document.getElementById('wallRate')
    let wallRate = rateInput.value == ''?defaultWallRate:(rateInput.value/100)
    if(wallRate > 80)
        wallRate = 80
    if(wallRate < 0)
        wallRate = 0
    
    var wallNumber = parseInt(wallRate*rowSize*columnSize)

    let n = 0
    while(n < wallNumber){
        let rowIndex = Math.floor(Math.random() * rowSize)
        let columnIndex = Math.floor(Math.random() * columnSize)

        let newWall =  divMatrix[rowIndex][columnIndex]

        if(!walls.includes(newWall)){
            newWall.classList.add('wall')
            walls.push(newWall)
            n++
        }
    }
}

function setStartPoint(row,column){
    if(isTraining)
        return
    if(divMatrix[row][column] == goalPoint.div)
        return
    if(startPoint.div)
    startPoint.div.removeAttribute('id')
    startPoint.row = row
    startPoint.column = column
    startPoint.div = divMatrix[row][column]
    startPoint.div.id = 'startPoint'

    setCurrentPoint(row,column)
}

function setGoalPoint(row,column){
    if(isTraining)
        return
    if(divMatrix[row][column] == startPoint.div)
        return
    if(goalPoint.div)
    goalPoint.div.removeAttribute('id')
    goalPoint.row = row
    goalPoint.column = column
    goalPoint.div = divMatrix[row][column]
    goalPoint.div.id = 'goalPoint'

    rTable = []
    qTable = []
    rTableGenerator()
    qTableInit()
}

async function setCurrentPoint(row, column){
    if(currentPoint.div){
        currentPoint.div.classList.remove("currentPoint")
        currentPoint.div.setAttribute('title',
            "Q Values" + "\n" +
            "North: " + qTable[currentPoint.row][currentPoint.column]['north'] + "\n" +
            "East: " + qTable[currentPoint.row][currentPoint.column]['east'] + "\n" +
            "South: " + qTable[currentPoint.row][currentPoint.column]['south'] + "\n" +
            "West: " + qTable[currentPoint.row][currentPoint.column]['west']
        )
    }
    currentPoint.row = row
    currentPoint.column = column
    currentPoint.div = divMatrix[row][column]
    currentPoint.div.classList.add('currentPoint')
}

function rTableGenerator(){
    for(let i = 0; i < rowSize; i++){
        let row = []
        for(let j = 0; j < columnSize; j++){
            let cell = new TableCell(i,j)

            // Update here to add new actions
            let north = divMatrix[i-1]?divMatrix[i-1][j]:undefined
            let west = divMatrix[i][j-1]
            let east = divMatrix[i][j+1]
            let south = divMatrix[i+1]?divMatrix[i+1][j]:undefined

            cell.north = rValue(north)
            cell.west = rValue(west)
            cell.east = rValue(east)
            cell.south = rValue(south)

            row.push(cell)
        }
        rTable.push(row)
    }
}

function rValue(neighbor){
    if(!neighbor){
        return 'cliff'
    }else if(neighbor.classList.contains('wall')){
        return penalty
    }else if(neighbor.id == 'goalPoint'){
        return reward
    }else{
        return spaceCell
    }
}

function qTableInit(){
    for(let i = 0; i < rowSize; i++){
        let row = []
        for(let j = 0; j < columnSize; j++){
            let cell = new TableCell(i,j)
            // Update here to add new actions
            if(rTable[i][j].north === 'cliff'){
                cell.north = 'cliff'
            }
            if(rTable[i][j].east === 'cliff'){
                cell.east = 'cliff'
            }
            if(rTable[i][j].west === 'cliff'){
                cell.west = 'cliff'
            }
            if(rTable[i][j].south === 'cliff'){
                cell.south = 'cliff'
            }
            divMatrix[i][j].setAttribute('title',
            "Q Values" + "\n" +
            "North: " + cell['north'] + "\n" +
            "East: " + cell['east'] + "\n" +
            "South: " + cell['south'] + "\n" +
            "West: " + cell['west']
            )
            row.push(cell)
        }
        qTable.push(row)
    }
}

function run(){

    if(!startPoint.div && !goalPoint.div){
        showWarning('Set the start and goal point')
        return
    }else if(!startPoint.div){
        showWarning('Set the start point')
        return
    }else if(!goalPoint.div){
        showWarning('Set the goal point')
        return
    }

    isTraining = true

    let generateMapButton = document.getElementById('generate')
    generateMapButton.classList.remove('able')
    generateMapButton.classList.add('disable')

    isTrainButtonAvtive = false

    controlButton.id = 'cancel'
    controlButton.innerText = 'CANCEL'


    if(shortestWayParts){
        clearShortestWay()
    }else{
        shortestWayParts = []
    }

    episodeViaCost = []
    episodeViaStep = []
    
    train()
}

function cancel(){
    isTraining = false
    isTrainButtonAvtive = true

    controlButton.id = 'train'
    controlButton.innerText = 'TRAIN'

    let generateMapButton = document.getElementById('generate')
    generateMapButton.classList.add('able')
    generateMapButton.classList.remove('disable')
}

async function train() {    

    let goalEpisode = document.getElementById('generation').value == ''?defaultGoalEpisode:document.getElementById('generation').value
    
    for(let episode = 0; episode < goalEpisode; episode++){
        while(!walls.includes(currentPoint.div) && currentPoint.div.id != 'goalPoint'){

            if(!isTraining)
                return

            let posibleActions = findPosibleActions(qTable[currentPoint.row][currentPoint.column])
            if(posibleActions.length == 0){
                    // There is no way to go
                    showWarning('There is no way to go!')
                    isTraining = false
                    isTrainButtonAvtive = true
                
                    controlButton.id = 'train'
                    controlButton.innerText = 'TRAIN'
                    let generateMapButton = document.getElementById('generate')
                    generateMapButton.classList.add('able')
                    generateMapButton.classList.remove('disable')
                    return
            }
            let action = posibleActions[Math.floor(Math.random() * posibleActions.length)]

            let nextRow = currentPoint.row + action.rowChanger
            let nextColumn = currentPoint.column + action.columnChanger

            let oldQValue = qTable[currentPoint.row][currentPoint.column][action.direction]
            let r = rTable[currentPoint.row][currentPoint.column][action.direction]

            let nextPossibleActions = findPosibleActions(qTable[nextRow][nextColumn])
            let nextMaximumQValue = Math.max(...nextPossibleActions.map(a => {return a.point}))


            let newQValue = oldQValue + learningRate * (r + discountFactor * nextMaximumQValue - oldQValue)


            if(rTable[currentPoint.row][currentPoint.column][action.direction] === penalty)
                newQValue = 'wall'

            qTable[currentPoint.row][currentPoint.column][action.direction] = newQValue

            if(waitTime > 0){
                window.requestAnimationFrame(
                    () => {
                        setCurrentPoint(nextRow, nextColumn)
                        if(currentPoint.div.id == 'goalPoint'){
                            document.getElementById('episodeCount').style.color = getComputedStyle(document.body)
                            .getPropertyValue('--goalColor')
                        }
                    }
                )
                await sleep(waitTime)
            }else{
                setCurrentPoint(nextRow, nextColumn)
            }

            if(currentPoint.div.id == 'startPoint')
                break
        }
        if(waitTime > 0){
            window.requestAnimationFrame(
                () => {
                setCurrentPoint(startPoint.row,startPoint.column)
                
                document.getElementById('episodeCount').innerHTML = 'Episode: ' + (episode+1)
                }
            )
            await sleep(waitTime)
            document.getElementById('episodeCount').style.color = '#fff'
        }else{
            setCurrentPoint(startPoint.row,startPoint.column)
            document.getElementById('episodeCount').innerHTML = 'Episode: ' + (episode+1)
        }
    }
    drawShortestWay()
    isTraining = false
    isTrainButtonAvtive = true

    controlButton.id = 'train'
    controlButton.innerText = 'TRAIN'
    let generateMapButton = document.getElementById('generate')
    generateMapButton.classList.add('able')
    generateMapButton.classList.remove('disable')
}

async function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

async function drawShortestWay(){
    let point = new Point(startPoint.div,startPoint.row,startPoint.column)

    while(point.div.id != 'goalPoint'){
        let posibleActions = findPosibleActions(qTable[point.row][point.column])
        if(posibleActions.length == 0)
            return
        let posibleMaxQActions = findMaxActions(posibleActions)
        if(posibleMaxQActions.every(item => item.point == 0)){
            showWarning('Training is not enough to find a shortest way')
            return
        }
        let maxQAction = posibleMaxQActions[Math.floor(Math.random() * posibleMaxQActions.length)]
        point.row += maxQAction.rowChanger
        point.column += maxQAction.columnChanger
        point.div = divMatrix[point.row][point.column]
        if(point.div.id == 'goalPoint')
            return

        window.requestAnimationFrame(
            () => {
                let innerDiv = document.createElement('div')
                innerDiv.style.width = '100%'
                innerDiv.style.height = '100%'
                innerDiv.classList.add('shortestWay')
                point.div.append(innerDiv)
                shortestWayParts.push(point.div)
            }
        )
        await sleep(75)
    }
}

function clearShortestWay(){
    shortestWayParts.forEach(
        part => {
            part.innerHTML = ''
        }
    )
    shortestWayParts = []
}

function findPosibleActions(point){
    // Update this funtion to add new actions
    let actions = []

    if(point.north != 'cliff' && point.north != 'wall'){
        actions.push(
            {
                direction: 'north',
                point: point.north,
                rowChanger: -1,
                columnChanger: 0
            }
        )
    }
    
    if(point.west != 'cliff' && point.west != 'wall'){
        actions.push(
            {
                direction: 'west',
                point: point.west,
                rowChanger: 0,
                columnChanger: -1
            }
        )
    }
    if(point.east != 'cliff' && point.east != 'wall'){
        actions.push(
            {
                direction: 'east',
                point: point.east,
                rowChanger: 0,
                columnChanger: +1
            }
        )
    }
    if(point.south != 'cliff' && point.south != 'wall'){
        actions.push(
            {
                direction: 'south',
                point: point.south,
                rowChanger: +1,
                columnChanger: 0
            }
        )
    }
    return actions
}

function findMaxActions(posibleActions){
    const maxPoint = Math.max(...posibleActions.map(i => {return i.point} ))
    const optimumActions = []
    posibleActions.forEach((action) => action.point == maxPoint?optimumActions.push(action):null)
    return optimumActions
}