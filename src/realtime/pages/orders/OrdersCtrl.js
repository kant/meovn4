mRealtime.controller('OdersCtrl',
    function($rootScope, $scope, $state, $stateParams, $filter, $timeout, cfpLoadingBar, 
        cfpLoadingBar, Facebook, firebaseService, ProductPackService, toastr,  toastrConfig, access_token_arr, activeItem) {

        $rootScope.access_token_arr = access_token_arr;

        angular.forEach(activeItem, function(value, key){
            // console.log(value);
            $rootScope.activeOrder = value;
            $rootScope.activeStatusId = value.status_id;
          });

        $scope.conversation_type = $stateParams.type;
        function AlertError(c, d) {
            toastr.error(c, d)
        };

        function AlertSuccessful(c, d) {
            toastr.success(c, d)
        };

        function AlertWarning(c, d) {
            toastr.warning(c, d)
        };

        toastrConfig.closeButton = true;
        toastrConfig.timeOut = 3000;

        $scope.isShowFullPost = false;
        $scope.showFullPost = function(){
          $scope.isShowFullPost = true;  
        }
    	$scope.filterById = function(sources, id){
            return $filter("filter")(sources, {
                id: id
            })[0];
        }

        $scope.activeLog = [];
        let activeLogRef = firebase.database().ref().child('newOrders/' + $stateParams.id + '/activeLog');
        activeLogRef.on('child_added', snapshot => {
            $scope.activeLog.push(snapshot.val());
        });
        $scope.noteContent = {};
        $scope.addNote = function(){
            if(!$scope.noteContent.text || $scope.noteContent.text.length == 0){
                // snackbar('Vui lòng nhập nội dung');
                AlertError('Vui lòng nhập nội dung', 'Lỗi');
                return;
            }
            var activeLogItem = {
                uid : $rootScope.currentMember.id,
                uname : $rootScope.currentMember.last_name,
                type: 2, //note,
                status_after : null,
                content: $scope.noteContent.text,
                updated_at: Date.now()
            }
            firebase.database().ref().child('newOrders/' + $stateParams.id).child('activeLog').push(activeLogItem);
            $scope.noteContent.text = '';
            // update comment count for this order
            firebase.database().ref().child('newOrders/' + $stateParams.id).child('commentCount').transaction(function(oldValue){
                  return oldValue + 1;
              });
            // update
            var itemChanged = $filter('filter')($rootScope.orders, {'id':$stateParams.id})[0];
            console.log(itemChanged);
            itemChanged.commentCount = 1;
        }


        function formatDateTime(dateStr){
            var year, month, day, hour, minute, dateUTC, date, ampm, d, time;
            var iso = (dateStr.indexOf(' ')==-1&&dateStr.substr(4,1)=='-'&&dateStr.substr(7,1)=='-'&&dateStr.substr(10,1)=='T') ? true : false;
         
            year = dateStr.substr(0,4);
            month = parseInt((dateStr.substr(5,1)=='0') ? dateStr.substr(6,1) : dateStr.substr(5,2))-1;
            day = dateStr.substr(8,2);
            hour = dateStr.substr(11,2);
            minute = dateStr.substr(14,2);
            dateUTC = Date.UTC(year, month, day, hour, minute);                 
            date = new Date(dateUTC);
            var curDate = new Date();
     
            var currentStamp = curDate.getTime();                   
            var datesec = date.setUTCSeconds(0);
            var difference = parseInt((currentStamp - datesec)/1000);
            return difference;                              
        }

        
        $scope.page_id = $stateParams.page_id;
        $scope.conversation = null;

        $scope.finishGraphPostDetail = false;

        // get current access token
        var getCurrentPageAccessToken = function(){
            if(!$rootScope.access_token_arr) {
                AlertError('Access token array is null', 'Error');
                return;
            }
            var token = $scope.filterById($rootScope.access_token_arr, $stateParams.page_id);
            if(token){
                $scope.currentAccessToken = token.acess_token;
            }
        }.call(this)

        // graph user
        if($stateParams.customer_id){
            Facebook.api('/' + $stateParams.customer_id + '?access_token=' + $rootScope.access_token, function(response) {
                // console.log(response);
                if(response && !response.error){
                    $scope.customer = response;
                }
            });
        }


        // graph page
        if($stateParams.page_id){
             Facebook.api('/' + $stateParams.page_id + '?fields=picture,name&access_token=' + $rootScope.access_token, function(response) {
                // console.log(response);
                if(response && !response.error){
                    $scope.$apply(function(){
                        $scope.data = response; 
                        $scope.finishGraphPage = true;
                    });
                    // graphPost($scope.post_id);
                    // graphOriginalConversation($scope.conversation_id);
                }
            });
        }

        // graph messages
        var graphMessages = function(){
            console.log($scope.currentAccessToken);
            // console.log('/' + $stateParams.conversation_id + '?fields=messages.limit(100){message,from,created_time,attachments,sticker,shares{link,description,name}},snippet,link,unread_count,participants&access_token=' + $scope.currentAccessToken);
            Facebook.api('/' + $stateParams.conversation_id + '?fields=messages.limit(100){message,from,created_time,attachments,sticker,shares{link,description,name}},snippet,link&access_token=' + $scope.currentAccessToken, function(r) {
                $scope.messsageLog = r;
                // console.log(r);
            });
        }

        // if mesage => graph all messages
        if($stateParams.type == 1){
            graphMessages();
        }

        // if comment => graph post owner
        if($stateParams.post_id){
            Facebook.api('/' + $stateParams.post_id + '?fields=full_picture,message,picture,attachments,story,permalink_url&date_format=U&access_token=' + $rootScope.access_token, function(response) {
                // console.log(response.attachments.data[0].subattachments.data);
                if(response && !response.error){
                    // console.log(response);
                    $scope.$apply(function(){
                        $scope.postData = response; 
                        $scope.finishGraphPostDetail = true; 
                    });
                }
            });
        }

        // if comment => graph conversation log
        var graphComments = function(){
            Facebook.api('/' + $stateParams.conversation_id + '?fields=comments{from,message,created_time,id,attachment},permalink_url,from,message,created_time&access_token=' + $scope.currentAccessToken, function(response) {
                // console.log(response);
                if(response && !response.error){
                    $scope.$apply(function(){
                        $scope.conversation = response;
                        $scope.finishGraphConversation = true; 
                    });
                }
            });
        }
        if(!$stateParams.type){
            graphComments();
        }

        /*
        * Detect shares link
        * there're two types of links: "link": "https://www.facebook.com/DaQuyPhongThuyTrangAn/posts/143302139668476"
        * and: "link": "https://www.facebook.com/DaQuyPhongThuyTrangAn/photos/a.141134469885243.1073741828.137428680255822/145291292802894/?type=3"
        */
        $scope.detectSharesLink = function(sharesLink){
            // console.log('detecting link...');
            var l = sharesLink.split('/').pop(); // ?type=3
            // alert(l);
            if (l.indexOf('?type=3') !== -1){
                // photos
                var k = sharesLink.split('/');
                // {{detectSharesLink(m.shares.data[0].link)}}/picture?height=720&width=720
                return '//graph.facebook.com/' + k[k.length - 2] + '/picture?height=720&width=720';
            }
            else{
                return sharesLink;
                // return '//graph.facebook.com/' + $stateParams.page_id + '_' + l + '?fields=picture' + '&access_token=' + $rootScope.access_token;
            }
        }
        
        // test reply comment
        $scope.comentText = null;
        $scope.replyToComment = function(){
            if(!$scope.comentText || $scope.comentText.length==0){
                // snackbar('Vui lòng nhập nội dung!');
                AlertError('Vui lòng nhập nội dung', 'Lỗi');
                return;
            } 
            if($stateParams.type == 1){
                replyMessage();
            }
            else{
                replyComment();
            }
            
        }

        var replyComment = function(){
            $scope.startReplying = true;
            FB.api(
                "/" + $stateParams.conversation_id + "/comments",
                "POST",
                {
                    "message": $scope.comentText,
                    // "attachment_url" : "http://pluspng.com/img-png/github-octocat-logo-vector-png-octocat-icon-1600.png",
                    "access_token" : $scope.currentAccessToken
                },
                function (response) {
                  if (response && !response.error) {
                    /* handle the result */
                    $scope.$apply(function(){
                        $scope.comentText = null;
                        graphComments();
                        $scope.startReplying = false;
                        // snackbar('Gửi bình luận thành công!');
                        AlertSuccessful('Gửi bình luận thành công', 'Thông báo');
                    });
                  }
                }
            );
        }
        var replyMessage = function(){
            $scope.startReplying = true;
            FB.api(
                "/" + $stateParams.conversation_id + "/messages",
                "POST",
                {
                    "message": $scope.comentText,
                    // "attachment_url" : "https://storage.googleapis.com/content.pages.fm/2017/12/24/33e1abe1858d07830ab3f53b2b2c08988c507b5a.jpg",
                    "access_token" : $scope.currentAccessToken
                },
                function (response) {
                  if (response && !response.error) {
                    /* handle the result */
                    $scope.$apply(function(){
                        $scope.comentText = null;
                        graphMessages();
                        $scope.startReplying = false;
                        // snackbar('Gửi tin nhắn thành công đến khách hàng!');
                        AlertSuccessful('Gửi tin nhắn thành công', 'Thông báo');
                    });
                  }
                }
            );
        }

        // snackbar functions
        // var snackbar = function(message){
        //     var options = {
        //       message : message,
        //       time: "SHORT"
        //     }
        //     $snackbar.show(options);
        // }

        // $scope.showSnackbar = function() {
        //     snackbar('Gửi tin nhắn thành công đến khách hàng');
        // };

        /**
        * Check before user change status
        * @param  {user}  user who changing status
        * @return {data}  data
        */
        function validationBeforChangeStatus(status){
            if($rootScope.currentMember.is_admin == 1){
               return true;
            }
            if($rootScope.activeOrder.seller_will_call_id !== $rootScope.currentMember.id){
                // snackbar('Oop! Thao tác không được chấp nhận!');
                AlertError('Không cho phép thay đổi trạng thái Order của người khác', 'Thông báo');
                return false;
            }

            if($rootScope.activeOrder.status_id == status.id){
                // snackbar('Oop! Không thay đổi trạng thái!');
                AlertWarning('Trạng thái không thay đổi', 'Thông báo');
                return false;
            }
            return true;
        }

        $scope.changeStatus = function(status){
            if(!validationBeforChangeStatus(status)){
                return;
            };
            // $rootScope.activeOrder.status_id = status.id;
            $rootScope.activeStatusId = status.id;
            
            var ref = firebase.database().ref();
            
            var thisOrderRef = ref.child('newOrders/' + $stateParams.id);
            // check if status_id exist
            thisOrderRef.child('status_id').once('value', function(snapshot) {
                if(snapshot.val() !== null){
                    // alert('Update');
                    thisOrderRef.update({
                        "status_id" : status.id
                    }).then(function(){
                        // update report                       
                        firebaseService.updateReport($rootScope.currentMember, snapshot.val(), status.id).then(function(response){
                            // console.log(response);
                        });
                        // update active log
                        var activeLogItem = {
                            uid : $rootScope.currentMember.id,
                            uname : $rootScope.currentMember.last_name,
                            type: 1, //change status,
                            status_after : status.id,
                            updated_at: Date.now()
                        }
                        firebase.database().ref().child('newOrders/' + $stateParams.id).child('activeLog').push(activeLogItem);

                    }).catch(function(error) {
                      console.log("Update failed." + error);
                    });
                } else{
                    alert($stateParams.id);

                    // thisOrderRef.update({
                    //     "status_id" : status.id
                    // }).then(function(){
                    //   console.log("Success!");
                         
                    // }).catch(function(error) {
                    //   console.log("Update failed." + error);
                    // });
                }
                
              });

            
            
        }
        function checkIfUserExists(userId) {
          var usersRef = new Firebase(USERS_LOCATION);
          usersRef.child(userId).once('value', function(snapshot) {
            var exists = (snapshot.val() !== null);
            userExistsCallback(userId, exists);
          });
        }

        // products
        // var products = [];
        

        // products.push(product);

        // get all products
        $scope.aProducts = [];
        var getAllAvailableProducts = function(){
          var ref = firebase.database().ref();
          let productsRef = ref.child('products');
          productsRef.on('child_added', snapshot => {
            $scope.aProducts.push(snapshot.val());
          });
        }
        getAllAvailableProducts();
        $scope.selectedProducts = [];
        // $scope.selectedProducts.push({
        //         id : 1,
        //         count : 0,
        //         note : ''
        //     });
        
        $scope.addProduct = function(){
            $scope.selectedProducts.push({
                id : null,
                count : 1,
                note : ''
            });
        }
        $scope.deleteProduct = function(index){
            console.log('xóa ' + index);
            $scope.selectedProducts.splice(index, 1);
        }
        $scope.customerData = {
            realName: "Khách lẻ",
            recievedPhone: '',
            birthDay: '',
            addresss: '',
            products: [],
            customerNote: '',
            orderNote: '',
            cod: 0,
        }
        $scope.newProduct = {
            name: ''
        };
        $scope.onAddNewProduct = function(){
            console.log($scope.newProduct.name);
            if($scope.newProduct.name == ''){
                AlertError('Vui lòng nhập tên sản phẩm', 'Thông báo');
                return false;
            }
            firebaseService.addNewProduct($scope.newProduct.name).then(function(response){
                console.log(response);
                AlertSuccessful('Thêm sản phẩm thành công', 'Thông báo');
                $scope.newProduct = {
                    name: ''
                };
            })
        }
        var validateCustomerData = function(){
            console.log($scope.selectedProducts);
            if(!$scope.customerData.birthDay || $scope.customerData.birthDay.length < 1){
                AlertError('Vui lòng nhập năm sinh', 'Thông báo');
                return false;
            }
            if(!angular.isNumber($scope.customerData.birthDay)){
                AlertError('Năm sinh không đúng', 'Thông báo');
                return false;
            }
            if(!angular.isNumber($scope.customerData.cod)){
                AlertError('Số tiền không đúng', 'Thông báo');
                return false;
            }
            if($scope.customerData.cod <= 10000){
                AlertError('Số tiền không đúng', 'Thông báo');
                return false;
            }
            if(!$scope.customerData.addresss || $scope.customerData.addresss.length < 1){
                AlertError('Vui lòng nhập địa chỉ nhận hàng', 'Thông báo');
                return false;
            }
            if(!$scope.selectedProducts || $scope.selectedProducts.length == 0){
                AlertError('Vui lòng thêm sản phẩm', 'Thông báo');
                return false;
            }
            if($scope.selectedProducts.length > 0){
                // if($scope.selectedProducts.indexOf(null) !== -1) {
                //   AlertError('Vui lòng chọn sản phẩm', 'Thông báo');
                //   return false;
                // }
                var pass = true;
                var countProductPass = true;
                angular.forEach($scope.selectedProducts, function(product){
                    pass = pass && product.id;
                    if(!angular.isNumber(product.count)){
                        AlertError('Số lượng không đúng', 'Thông báo');
                        return false;
                    }
                    if(product.count < 1){
                        countProductPass = false;
                    }
                })
                if(!countProductPass){
                    AlertError('Số lượng không đúng', 'Thông báo');
                    return false;
                }
                if(!pass){
                    AlertError('Vui lòng chọn sản phẩm', 'Thông báo');
                    return false;
                }
            }
            return true;
        }
        $scope.onSubmitOrder = function(){
            if(validateCustomerData()){
                $scope.customerData.products = $scope.selectedProducts;
                // console.log($scope.customerData);
                

                //
                // console.log($rootScope.statuses);
                var successStatus = $rootScope.filterById($rootScope.statuses, 6);
                if(successStatus){
                    $scope.changeStatus(successStatus);
                    // add shipping item
                    var data = {
                        customerData : $scope.customerData,
                        orderData : {
                            conversation_id : $rootScope.activeOrder.conversation_id,
                            customer_id : $rootScope.activeOrder.customer_id,
                            customer_name : $rootScope.activeOrder.customer_name,
                            id : $rootScope.activeOrder.id,
                            page_id: $rootScope.activeOrder.page_id,
                            post_id : $rootScope.activeOrder.post_id || null,
                            publish_date : $rootScope.activeOrder.publish_date,
                            status_id : $rootScope.activeOrder.status_id,
                            type :  $rootScope.activeOrder.type || null
                        },
                        created_time : Date.now()
                    }
                    firebaseService.addNewShippingItem(data).then(function(response){

                    })
                    AlertSuccessful('Chốt đơn hàng thành công', 'Thông báo');
                    // addNewShippingItem
                }

                // reset customerData
                $scope.customerData = {
                    realName: "Khách lẻ",
                    recievedPhone: '',
                    birthDay: '',
                    addresss: '',
                }
                // reset products
                $scope.selectedProducts = [];
            }
        }

        //  EDIT ORDER

        $scope.showEditOrderForm = false;
        $scope.finishedLoadOrderToEdit = true;

        /*
        * Show edit form for success order (order with status id == 6)
        *
        */
        $scope.showEditOrder = function(){
            firebaseService.getShippingItemByOrderId($rootScope.activeOrder.id).then(function(snapshot){
                $scope.$apply(function(){
                    angular.forEach(snapshot.val(), function(value, key){
                        $scope.editData = value;
                    });
                    $scope.showEditOrderForm = true;
                })
            });
        }
	});